package activities

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"time"

	"github.com/AdonisEnProvence/MusicRoom/shared"
	"go.temporal.io/sdk/activity"
)

func PingActivity(_ context.Context) error {
	_, err := http.Get(ADONIS_ENDPOINT + "/ping")

	return err
}

func PauseActivity(_ context.Context, roomID string) error {
	url := ADONIS_ENDPOINT + "/temporal/pause/" + url.QueryEscape(roomID)
	_, err := http.Get(url)

	return err
}

func PlayActivity(_ context.Context, roomID string) error {
	url := ADONIS_ENDPOINT + "/temporal/play/" + url.QueryEscape(roomID)
	_, err := http.Get(url)

	return err
}

func CreationAcknowledgementActivity(_ context.Context, state shared.MtvRoomExposedState) error {
	marshaledBody, err := json.Marshal(state)
	if err != nil {
		return err
	}

	url := ADONIS_ENDPOINT + "/temporal/mtv-creation-acknowledgement"

	_, err = http.Post(url, "application/json", bytes.NewBuffer(marshaledBody))

	return err
}

type mtvJoinCallbackRequestBody struct {
	State         shared.MtvRoomExposedState `json:"state"`
	JoiningUserID string                     `json:"joiningUserID"`
}

func JoinActivity(ctx context.Context, state shared.MtvRoomExposedState, joiningUserID string) error {
	requestBody := mtvJoinCallbackRequestBody{
		State:         state,
		JoiningUserID: joiningUserID,
	}

	marshaledBody, err := json.Marshal(requestBody)
	if err != nil {
		return err
	}

	url := ADONIS_ENDPOINT + "/temporal/join"
	_, err = http.Post(url, "application/json", bytes.NewBuffer(marshaledBody))

	return err
}

func TrackTimerActivity(ctx context.Context, timerState shared.MtvRoomTimer) (shared.MtvRoomTimer, error) {
	timerStartTime := time.Now()
	durationBeforeTrackEnd := timerState.TotalDuration - timerState.Elapsed
	timer := time.NewTimer(durationBeforeTrackEnd) //40 sec
	twoSecondsDuration := 2 * time.Second

	for {
		heartbeatTimer := time.NewTimer(twoSecondsDuration)
		select {
		case <-timer.C:
			// timer ended
			timerState.State = shared.MtvRoomTimerStateFinished
			timerState.Elapsed = timerState.TotalDuration

			return timerState, nil

		case <-ctx.Done():
			// context was canceled
			cancelationTime := time.Now()
			elapsedTimeSinceTimerStart := cancelationTime.Sub(timerStartTime)

			timerState.State = shared.MtvRoomTimerStatePending
			timerState.Elapsed += elapsedTimeSinceTimerStart

			return timerState, nil
		case <-heartbeatTimer.C:

			// heartbeat timer ended, going again in the loop
			RecordHeartbeatWrapper(ctx, "status-timer-report-to-workflow")
		}
	}
}

type RecordHeartbeatWrapperType func(ctx context.Context, details ...interface{})

var RecordHeartbeatWrapper RecordHeartbeatWrapperType = activity.RecordHeartbeat
