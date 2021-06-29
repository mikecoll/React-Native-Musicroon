package workflows

import (
	"fmt"
	"time"

	"github.com/AdonisEnProvence/MusicRoom/activities"
	"github.com/AdonisEnProvence/MusicRoom/shared"
	"github.com/Devessier/brainy"

	"github.com/mitchellh/mapstructure"
	"go.temporal.io/sdk/workflow"
)

type MtvRoomInternalState struct {
	initialParams shared.MtvRoomParameters

	Machine       *brainy.Machine
	Users         []string
	TracksIDsList []string
	CurrentTrack  shared.TrackMetadata
	Tracks        []shared.TrackMetadata
}

func (s *MtvRoomInternalState) FillWith(params shared.MtvRoomParameters) {
	s.initialParams = params

	copy(s.Users, params.InitialUsers)
	copy(s.TracksIDsList, params.InitialTracksIDsList)
}

func (s *MtvRoomInternalState) Export() shared.MtvRoomExposedState {
	isPlaying := false
	if machine := s.Machine; machine != nil {
		isPlaying = machine.Current().Matches(MtvRoomPlayingState)
	}

	exposedState := shared.MtvRoomExposedState{
		RoomID:            s.initialParams.RoomID,
		RoomCreatorUserID: s.initialParams.RoomCreatorUserID,
		Playing:           isPlaying,
		RoomName:          s.initialParams.RoomName,
		Users:             s.Users,
		TracksIDsList:     s.TracksIDsList,
		CurrentTrack:      s.CurrentTrack,
		Tracks:            s.Tracks,
	}

	return exposedState
}

func (s *MtvRoomInternalState) AddUser(userID string) {
	s.Users = append(s.Users, userID)
}

type MtvRoomMachineContext struct {
	Timer       shared.MtvRoomTimer
	CancelTimer func()
}

const (
	MtvRoomPausedState                 brainy.StateType = "paused"
	MtvRoomPausedStoppingState         brainy.StateType = "stopping"
	MtvRoomPausedStoppedState          brainy.StateType = "stopped"
	MtvRoomPlayingState                brainy.StateType = "playing"
	MtvRoomPlayingLaunchingTimerState  brainy.StateType = "launching-timer"
	MtvRoomPlayingWaitingTimerEndState brainy.StateType = "waiting-timer-end"
	MtvRoomPlayingTimeoutExpiredState  brainy.StateType = "timeout-expired"

	MtvRoomPlayEvent          brainy.EventType = "PLAY"
	MtvRoomPauseEvent         brainy.EventType = "PAUSE"
	MtvRoomTimerLaunchedEvent brainy.EventType = "TIMER_LAUNCHED"
	MtvRoomTimerExpiredEvent  brainy.EventType = "TIMER_EXPIRED"
	MtvRoomGoToPausedEvent    brainy.EventType = "GO_TO_PAUSED"
)

type MtvRoomTimerExpirationEvent struct {
	brainy.EventWithType

	Timer shared.MtvRoomTimer
}

func NewMtvRoomTimerExpirationEvent(t shared.MtvRoomTimer) MtvRoomTimerExpirationEvent {
	return MtvRoomTimerExpirationEvent{
		EventWithType: brainy.EventWithType{
			Event: MtvRoomTimerExpiredEvent,
		},
		Timer: t,
	}
}

func MtvRoomWorkflow(ctx workflow.Context, params shared.MtvRoomParameters) error {
	var (
		err           error
		internalState MtvRoomInternalState
	)

	internalState.FillWith(params)

	logger := workflow.GetLogger(ctx)

	if err := workflow.SetQueryHandler(
		ctx,
		shared.MtvGetStateQuery,
		func(input []byte) (shared.MtvRoomExposedState, error) {
			exposedState := internalState.Export()

			return exposedState, nil
		},
	); err != nil {
		logger.Info("SetQueryHandler failed.", "Error", err)
		return err
	}

	channel := workflow.GetSignalChannel(ctx, shared.SignalChannelName)
	terminated := false

	internalState.Tracks, err = getInitialTracksInformation(ctx, internalState.TracksIDsList)
	if err != nil {
		return err
	}

	if err := acknowledgeRoomCreation(ctx, internalState.Export()); err != nil {
		return err
	}

	if tracksCount := len(internalState.Tracks); tracksCount > 0 {
		currentTrack := internalState.Tracks[0]
		internalState.CurrentTrack = currentTrack

		if tracksCount == 1 {
			internalState.Tracks = []shared.TrackMetadata{}
			internalState.TracksIDsList = []string{}
		} else {
			internalState.Tracks = internalState.Tracks[1:]
			internalState.TracksIDsList = internalState.TracksIDsList[1:]
		}
	}

	internalState.Machine, err = brainy.NewMachine(brainy.StateNode{
		Context: &MtvRoomMachineContext{
			Timer: shared.MtvRoomTimer{
				State:         shared.MtvRoomTimerStateIdle,
				Elapsed:       0,
				TotalDuration: internalState.CurrentTrack.Duration,
			},
		},

		Initial: MtvRoomPausedState,

		States: brainy.StateNodes{
			MtvRoomPausedState: &brainy.StateNode{
				OnEntry: brainy.Actions{
					brainy.ActionFn(
						func(c brainy.Context, e brainy.Event) error {
							options := workflow.ActivityOptions{
								ScheduleToStartTimeout: time.Minute,
								StartToCloseTimeout:    time.Minute,
							}
							ctx = workflow.WithActivityOptions(ctx, options)

							err := workflow.ExecuteActivity(
								ctx,
								activities.PauseActivity,
								params.RoomID,
							).Get(ctx, nil)

							return err
						},
					),
				},

				On: brainy.Events{
					MtvRoomPlayEvent: brainy.Transition{
						Target: MtvRoomPlayingState,

						Actions: brainy.Actions{
							brainy.ActionFn(
								func(c brainy.Context, e brainy.Event) error {
									options := workflow.ActivityOptions{
										ScheduleToStartTimeout: time.Minute,
										StartToCloseTimeout:    time.Minute,
									}
									ctx = workflow.WithActivityOptions(ctx, options)

									err := workflow.ExecuteActivity(
										ctx,
										activities.PlayActivity,
										params.RoomID,
									).Get(ctx, nil)

									return err
								},
							),
						},
					},
				},
			},

			MtvRoomPlayingState: &brainy.StateNode{
				Initial: MtvRoomPlayingLaunchingTimerState,

				States: brainy.StateNodes{
					MtvRoomPlayingLaunchingTimerState: &brainy.StateNode{
						OnEntry: brainy.Actions{
							brainy.ActionFn(
								func(c brainy.Context, e brainy.Event) error {
									timerContext := c.(*MtvRoomMachineContext)

									workflow.Go(ctx, func(ctx workflow.Context) {
										ao := workflow.ActivityOptions{
											ScheduleToStartTimeout: 5 * time.Second,
											StartToCloseTimeout:    internalState.CurrentTrack.Duration * 2,
										}
										ctx = workflow.WithActivityOptions(ctx, ao)

										ctx, cancel := workflow.WithCancel(ctx)
										timerContext.CancelTimer = cancel

										var timerActivityResult shared.MtvRoomTimer

										internalState.Machine.Send(MtvRoomTimerLaunchedEvent)

										if err := workflow.ExecuteActivity(
											ctx,
											activities.TrackTimerActivity,
											timerContext.Timer,
										).Get(ctx, &timerActivityResult); err != nil {
											logger.Error("error occured in timer activity", err)

											return
										}

										// internalState.Machine.Send(
										// 	NewMtvRoomTimerExpirationEvent(timerActivityResult),
										// )

										fmt.Println("after send")

										timerContext.CancelTimer = nil
									})

									return nil
								},
							),
						},

						On: brainy.Events{
							MtvRoomTimerLaunchedEvent: MtvRoomPlayingWaitingTimerEndState,
						},
					},

					MtvRoomPlayingWaitingTimerEndState: &brainy.StateNode{
						On: brainy.Events{
							MtvRoomTimerExpiredEvent: brainy.Transition{
								Target: MtvRoomPlayingTimeoutExpiredState,

								Actions: brainy.Actions{
									brainy.ActionFn(
										func(c brainy.Context, e brainy.Event) error {
											ctx := c.(*MtvRoomMachineContext)
											event := e.(MtvRoomTimerExpirationEvent)

											ctx.Timer = event.Timer

											return nil
										},
									),
								},
							},

							MtvRoomPauseEvent: brainy.Transition{
								Actions: brainy.Actions{
									brainy.ActionFn(
										func(c brainy.Context, e brainy.Event) error {
											ctx := c.(*MtvRoomMachineContext)

											if cancel := ctx.CancelTimer; cancel != nil {
												cancel()
											}

											return nil
										},
									),
								},
							},
						},
					},

					MtvRoomPlayingTimeoutExpiredState: &brainy.StateNode{
						OnEntry: brainy.Actions{
							brainy.Send(MtvRoomGoToPausedEvent),
						},
					},
				},

				On: brainy.Events{
					MtvRoomGoToPausedEvent: MtvRoomPausedState,
				},
			},
		},
	}, brainy.WithDisableLocking())
	if err != nil {
		fmt.Printf("machine error : %v\n", err)
		return err
	}

	for {
		selector := workflow.NewSelector(ctx)

		selector.AddReceive(channel, func(c workflow.ReceiveChannel, _ bool) {
			var signal interface{}
			c.Receive(ctx, &signal)

			var routeSignal shared.GenericRouteSignal

			if err := mapstructure.Decode(signal, &routeSignal); err != nil {
				logger.Error("Invalid signal type %v", err)
				return
			}

			switch routeSignal.Route {
			case shared.SignalRoutePlay:
				var message shared.PlaySignal

				if err := mapstructure.Decode(signal, &message); err != nil {
					logger.Error("Invalid signal type %v", err)
					return
				}

				internalState.Machine.Send(MtvRoomPlayEvent)

			case shared.SignalRoutePause:
				var message shared.PauseSignal

				if err := mapstructure.Decode(signal, &message); err != nil {
					logger.Error("Invalid signal type %v", err)
					return
				}

				internalState.Machine.Send(MtvRoomPauseEvent)

			case shared.SignalRouteJoin:
				var message shared.JoinSignal

				if err := mapstructure.Decode(signal, &message); err != nil {
					logger.Error("Invalid signal type %v", err)
					return
				}

				// TODO: should go inside the state machine

				internalState.AddUser(message.UserID)

				options := workflow.ActivityOptions{
					ScheduleToStartTimeout: time.Minute,
					StartToCloseTimeout:    time.Minute,
				}
				ctx = workflow.WithActivityOptions(ctx, options)
				if err := workflow.ExecuteActivity(
					ctx,
					activities.JoinActivity,
					internalState.Export(),
				).Get(ctx, nil); err != nil {
					return
				}
			case shared.SignalRouteTerminate:
				terminated = true
			}
		})

		selector.Select(ctx)

		if terminated {
			break
		}
	}

	return nil
}

func getInitialTracksInformation(ctx workflow.Context, initialTracksIDs []string) ([]shared.TrackMetadata, error) {
	ao := workflow.ActivityOptions{
		ScheduleToStartTimeout: time.Minute,
		StartToCloseTimeout:    time.Minute,
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var initialTracksMetadata []shared.TrackMetadata

	if err := workflow.ExecuteActivity(
		ctx,
		activities.FetchTracksInformationActivity,
		initialTracksIDs,
	).Get(ctx, &initialTracksMetadata); err != nil {
		return nil, err
	}

	return initialTracksMetadata, nil
}

func acknowledgeRoomCreation(ctx workflow.Context, state shared.MtvRoomExposedState) error {
	ao := workflow.ActivityOptions{
		ScheduleToStartTimeout: time.Minute,
		StartToCloseTimeout:    time.Minute,
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	if err := workflow.ExecuteActivity(
		ctx,
		activities.CreationAcknowledgementActivity,
		state,
	).Get(ctx, nil); err != nil {
		return err
	}

	return nil
}
