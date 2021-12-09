package mpe

import (
	"testing"
	"time"

	"github.com/AdonisEnProvence/MusicRoom/activities"
	activities_mpe "github.com/AdonisEnProvence/MusicRoom/mpe/activities"
	shared_mpe "github.com/AdonisEnProvence/MusicRoom/mpe/shared"
	"github.com/AdonisEnProvence/MusicRoom/shared"
	"github.com/bxcodec/faker/v3"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
	"go.temporal.io/sdk/workflow"
)

type EditingPlaylistTestSuite struct {
	UnitTestSuite
}

func (s *EditingPlaylistTestSuite) Test_AddTracks() {
	params, _ := s.getWorkflowInitParams(faker.UUIDHyphenated())
	roomCreatorDeviceID := faker.UUIDHyphenated()
	initialTracksIDs := []string{
		params.InitialTrackID,
	}
	initialTracksMetadata := []shared.TrackMetadata{
		{
			ID:         initialTracksIDs[0],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
	}
	tracksIDsToAdd := []string{
		faker.UUIDHyphenated(),
		faker.UUIDHyphenated(),
	}
	tracksToAddMetadata := []shared.TrackMetadata{
		{
			ID:         tracksIDsToAdd[0],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
		{
			ID:         tracksIDsToAdd[1],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
	}

	tick := 1 * time.Millisecond
	resetMock, registerDelayedCallbackWrapper := s.initTestEnv()

	defer resetMock()

	// Common activities calls
	s.env.OnActivity(
		activities_mpe.MpeCreationAcknowledgementActivity,
		mock.Anything,
		mock.Anything,
	).Return(nil).Once()
	s.env.OnActivity(
		activities.FetchTracksInformationActivity,
		mock.Anything,
		initialTracksIDs,
	).Return(initialTracksMetadata, nil).Once()

	// Specific activities calls
	s.env.OnActivity(
		activities.FetchTracksInformationActivityAndForwardInitiator,
		mock.Anything,
		tracksIDsToAdd,
		params.RoomCreatorUserID,
		roomCreatorDeviceID,
	).Return(activities.FetchedTracksInformationWithInitiator{
		Metadata: tracksToAddMetadata,
		UserID:   params.RoomCreatorUserID,
		DeviceID: roomCreatorDeviceID,
	}, nil).Once()

	s.env.OnActivity(
		activities_mpe.AcknowledgeAddingTracksActivity,
		mock.Anything,
		mock.Anything,
	).Return(nil).Once()

	initialTracksFetched := tick * 200
	registerDelayedCallbackWrapper(func() {
		mpeState := s.getMpeState(shared_mpe.NoRelatedUserID)

		s.Equal(initialTracksMetadata, mpeState.Tracks)
	}, initialTracksFetched)

	addTrack := tick * 200
	registerDelayedCallbackWrapper(func() {
		s.emitAddTrackSignal(shared_mpe.NewAddTracksSignalArgs{
			TracksIDs: tracksIDsToAdd,
			UserID:    params.RoomCreatorUserID,
			DeviceID:  roomCreatorDeviceID,
		})
	}, addTrack)

	checkAddingTracks := tick * 200
	registerDelayedCallbackWrapper(func() {
		mpeState := s.getMpeState(shared_mpe.NoRelatedUserID)

		initialTracksMetadataWithTracksToAddMetadata := append(initialTracksMetadata, tracksToAddMetadata...)

		s.Equal(
			initialTracksMetadataWithTracksToAddMetadata,
			mpeState.Tracks,
		)
	}, checkAddingTracks)

	s.env.ExecuteWorkflow(MpeRoomWorkflow, params)

	s.True(s.env.IsWorkflowCompleted())
	err := s.env.GetWorkflowError()
	s.ErrorIs(err, workflow.ErrDeadlineExceeded, "The workflow ran on an infinite loop")
}

func (s *EditingPlaylistTestSuite) Test_AddingTrackAlreadyInPlaylistBeforeFetchingInformationFails() {
	params, _ := s.getWorkflowInitParams(faker.UUIDHyphenated())
	roomCreatorDeviceID := faker.UUIDHyphenated()
	initialTracksIDs := []string{
		params.InitialTrackID,
	}
	initialTracksMetadata := []shared.TrackMetadata{
		{
			ID:         initialTracksIDs[0],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
	}
	tracksIDsToAdd := []string{
		initialTracksIDs[0],
	}

	tick := 1 * time.Millisecond
	resetMock, registerDelayedCallbackWrapper := s.initTestEnv()

	defer resetMock()

	// Common activities calls
	s.env.OnActivity(
		activities_mpe.MpeCreationAcknowledgementActivity,
		mock.Anything,
		mock.Anything,
	).Return(nil).Once()
	s.env.OnActivity(
		activities.FetchTracksInformationActivity,
		mock.Anything,
		initialTracksIDs,
	).Return(initialTracksMetadata, nil).Once()

	// Specific activities calls
	s.env.OnActivity(
		activities_mpe.RejectAddingTracksActivity,
		mock.Anything,
		activities_mpe.RejectAddingTracksActivityArgs{
			RoomID:   params.RoomID,
			DeviceID: roomCreatorDeviceID,
		},
	).Return(nil).Once()

	initialTracksFetched := tick * 200
	registerDelayedCallbackWrapper(func() {
		mpeState := s.getMpeState(shared_mpe.NoRelatedUserID)

		s.Equal(initialTracksMetadata, mpeState.Tracks)
	}, initialTracksFetched)

	addTrack := tick * 200
	registerDelayedCallbackWrapper(func() {
		s.emitAddTrackSignal(shared_mpe.NewAddTracksSignalArgs{
			TracksIDs: tracksIDsToAdd,
			UserID:    params.RoomCreatorUserID,
			DeviceID:  roomCreatorDeviceID,
		})
	}, addTrack)

	checkAddingTracks := tick * 200
	registerDelayedCallbackWrapper(func() {
		mpeState := s.getMpeState(shared_mpe.NoRelatedUserID)

		s.Equal(
			initialTracksMetadata,
			mpeState.Tracks,
		)
	}, checkAddingTracks)

	s.env.ExecuteWorkflow(MpeRoomWorkflow, params)

	s.True(s.env.IsWorkflowCompleted())
	err := s.env.GetWorkflowError()
	s.ErrorIs(err, workflow.ErrDeadlineExceeded, "The workflow ran on an infinite loop")
}

func (s *EditingPlaylistTestSuite) Test_AddingTrackAlreadyInPlaylistAfterFetchingInformationSucceedsIfNotAllTracksAreDuplicated() {
	params, _ := s.getWorkflowInitParams(faker.UUIDHyphenated())
	roomCreatorDeviceID := faker.UUIDHyphenated()
	initialTracksIDs := []string{
		params.InitialTrackID,
	}
	initialTracksMetadata := []shared.TrackMetadata{
		{
			ID:         initialTracksIDs[0],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
	}
	tracksIDsToAddFirstBatch := []string{
		faker.UUIDHyphenated(),
		faker.UUIDHyphenated(),
	}
	tracksToAddMetadataFirstBatch := []shared.TrackMetadata{
		{
			ID:         tracksIDsToAddFirstBatch[0],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
		{
			ID:         tracksIDsToAddFirstBatch[1],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
	}
	tracksIDsToAddSecondBatch := []string{
		tracksIDsToAddFirstBatch[0],
		faker.UUIDHyphenated(),
	}
	tracksToAddMetadataSecondBatch := []shared.TrackMetadata{
		tracksToAddMetadataFirstBatch[0],
		{
			ID:         tracksIDsToAddSecondBatch[1],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
	}

	tick := 1 * time.Millisecond
	resetMock, registerDelayedCallbackWrapper := s.initTestEnv()

	defer resetMock()

	// Common activities calls
	s.env.OnActivity(
		activities_mpe.MpeCreationAcknowledgementActivity,
		mock.Anything,
		mock.Anything,
	).Return(nil).Once()
	s.env.OnActivity(
		activities.FetchTracksInformationActivity,
		mock.Anything,
		initialTracksIDs,
	).Return(initialTracksMetadata, nil).Once()

	// Specific activities calls
	//
	// Wait for 10 seconds before returning result of the activity.
	const firstBatchTracksInformationFetchingDebouncingDelay = 10 * time.Second
	s.env.OnActivity(
		activities.FetchTracksInformationActivityAndForwardInitiator,
		mock.Anything,
		tracksIDsToAddFirstBatch,
		params.RoomCreatorUserID,
		roomCreatorDeviceID,
	).Return(activities.FetchedTracksInformationWithInitiator{
		Metadata: tracksToAddMetadataFirstBatch,
		UserID:   params.RoomCreatorUserID,
		DeviceID: roomCreatorDeviceID,
	}, nil).Once().After(firstBatchTracksInformationFetchingDebouncingDelay)

	s.env.OnActivity(
		activities.FetchTracksInformationActivityAndForwardInitiator,
		mock.Anything,
		tracksIDsToAddSecondBatch,
		params.RoomCreatorUserID,
		roomCreatorDeviceID,
	).Return(activities.FetchedTracksInformationWithInitiator{
		Metadata: tracksToAddMetadataSecondBatch,
		UserID:   params.RoomCreatorUserID,
		DeviceID: roomCreatorDeviceID,
	}, nil).Once()

	s.env.OnActivity(
		activities_mpe.AcknowledgeAddingTracksActivity,
		mock.Anything,
		mock.Anything,
	).Return(nil).Twice()

	initialTracksFetched := tick * 200
	registerDelayedCallbackWrapper(func() {
		mpeState := s.getMpeState(shared_mpe.NoRelatedUserID)

		s.Equal(initialTracksMetadata, mpeState.Tracks)
	}, initialTracksFetched)

	addTrackFirstBatch := tick * 200
	registerDelayedCallbackWrapper(func() {
		s.emitAddTrackSignal(shared_mpe.NewAddTracksSignalArgs{
			TracksIDs: tracksIDsToAddFirstBatch,
			UserID:    params.RoomCreatorUserID,
			DeviceID:  roomCreatorDeviceID,
		})
	}, addTrackFirstBatch)

	addTrackSecondBatch := tick
	registerDelayedCallbackWrapper(func() {
		s.emitAddTrackSignal(shared_mpe.NewAddTracksSignalArgs{
			TracksIDs: tracksIDsToAddSecondBatch,
			UserID:    params.RoomCreatorUserID,
			DeviceID:  roomCreatorDeviceID,
		})
	}, addTrackSecondBatch)

	checkAddingTracks := firstBatchTracksInformationFetchingDebouncingDelay
	registerDelayedCallbackWrapper(func() {
		mpeState := s.getMpeState(shared_mpe.NoRelatedUserID)

		initialTracksMetadataWithTracksToAddMetadataSecondBatch := append(initialTracksMetadata, tracksToAddMetadataSecondBatch...)
		initialTracksMetadataWithTracksToAddMetadataSecondBatchWithNonDuplicatedTracksMetadataFirstBatch := append(initialTracksMetadataWithTracksToAddMetadataSecondBatch, tracksToAddMetadataFirstBatch[1])

		s.Equal(
			initialTracksMetadataWithTracksToAddMetadataSecondBatchWithNonDuplicatedTracksMetadataFirstBatch,
			mpeState.Tracks,
		)
	}, checkAddingTracks)

	s.env.ExecuteWorkflow(MpeRoomWorkflow, params)

	s.True(s.env.IsWorkflowCompleted())
	err := s.env.GetWorkflowError()
	s.ErrorIs(err, workflow.ErrDeadlineExceeded, "The workflow ran on an infinite loop")
}

func (s *EditingPlaylistTestSuite) Test_AddingTrackAlreadyInPlaylistAfterFetchingInformationFailsIfAllTracksAreDuplicated() {
	params, _ := s.getWorkflowInitParams(faker.UUIDHyphenated())
	roomCreatorDeviceID := faker.UUIDHyphenated()
	initialTracksIDs := []string{
		params.InitialTrackID,
	}
	initialTracksMetadata := []shared.TrackMetadata{
		{
			ID:         initialTracksIDs[0],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
	}
	tracksIDsToAddFirstBatch := []string{
		faker.UUIDHyphenated(),
		faker.UUIDHyphenated(),
	}
	tracksToAddMetadataFirstBatch := []shared.TrackMetadata{
		{
			ID:         tracksIDsToAddFirstBatch[0],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
		{
			ID:         tracksIDsToAddFirstBatch[1],
			Title:      faker.Word(),
			ArtistName: faker.Name(),
			Duration:   42000,
		},
	}
	tracksIDsToAddSecondBatch := []string{
		tracksIDsToAddFirstBatch[0],
		tracksIDsToAddFirstBatch[1],
	}
	tracksToAddMetadataSecondBatch := []shared.TrackMetadata{
		tracksToAddMetadataFirstBatch[0],
		tracksToAddMetadataFirstBatch[1],
	}

	tick := 1 * time.Millisecond
	resetMock, registerDelayedCallbackWrapper := s.initTestEnv()

	defer resetMock()

	// Common activities calls
	s.env.OnActivity(
		activities_mpe.MpeCreationAcknowledgementActivity,
		mock.Anything,
		mock.Anything,
	).Return(nil).Once()
	s.env.OnActivity(
		activities.FetchTracksInformationActivity,
		mock.Anything,
		initialTracksIDs,
	).Return(initialTracksMetadata, nil).Once()

	// Specific activities calls
	//
	// Wait for 10 seconds before returning result of the activity.
	const firstBatchTracksInformationFetchingDebouncingDelay = 10 * time.Second
	s.env.OnActivity(
		activities.FetchTracksInformationActivityAndForwardInitiator,
		mock.Anything,
		tracksIDsToAddFirstBatch,
		params.RoomCreatorUserID,
		roomCreatorDeviceID,
	).Return(activities.FetchedTracksInformationWithInitiator{
		Metadata: tracksToAddMetadataFirstBatch,
		UserID:   params.RoomCreatorUserID,
		DeviceID: roomCreatorDeviceID,
	}, nil).Once().After(firstBatchTracksInformationFetchingDebouncingDelay)

	s.env.OnActivity(
		activities.FetchTracksInformationActivityAndForwardInitiator,
		mock.Anything,
		tracksIDsToAddSecondBatch,
		params.RoomCreatorUserID,
		roomCreatorDeviceID,
	).Return(activities.FetchedTracksInformationWithInitiator{
		Metadata: tracksToAddMetadataSecondBatch,
		UserID:   params.RoomCreatorUserID,
		DeviceID: roomCreatorDeviceID,
	}, nil).Once()

	s.env.OnActivity(
		activities_mpe.AcknowledgeAddingTracksActivity,
		mock.Anything,
		mock.Anything,
	).Return(nil).Once()

	s.env.OnActivity(
		activities_mpe.RejectAddingTracksActivity,
		mock.Anything,
		activities_mpe.RejectAddingTracksActivityArgs{
			RoomID:   params.RoomID,
			DeviceID: roomCreatorDeviceID,
		},
	).Return(nil).Once()

	initialTracksFetched := tick * 200
	registerDelayedCallbackWrapper(func() {
		mpeState := s.getMpeState(shared_mpe.NoRelatedUserID)

		s.Equal(initialTracksMetadata, mpeState.Tracks)
	}, initialTracksFetched)

	addTrackFirstBatch := tick * 200
	registerDelayedCallbackWrapper(func() {
		s.emitAddTrackSignal(shared_mpe.NewAddTracksSignalArgs{
			TracksIDs: tracksIDsToAddFirstBatch,
			UserID:    params.RoomCreatorUserID,
			DeviceID:  roomCreatorDeviceID,
		})
	}, addTrackFirstBatch)

	addTrackSecondBatch := tick
	registerDelayedCallbackWrapper(func() {
		s.emitAddTrackSignal(shared_mpe.NewAddTracksSignalArgs{
			TracksIDs: tracksIDsToAddSecondBatch,
			UserID:    params.RoomCreatorUserID,
			DeviceID:  roomCreatorDeviceID,
		})
	}, addTrackSecondBatch)

	checkAddingTracks := firstBatchTracksInformationFetchingDebouncingDelay
	registerDelayedCallbackWrapper(func() {
		mpeState := s.getMpeState(shared_mpe.NoRelatedUserID)

		initialTracksMetadataWithTracksToAddMetadataSecondBatch := append(initialTracksMetadata, tracksToAddMetadataSecondBatch...)

		s.Equal(
			initialTracksMetadataWithTracksToAddMetadataSecondBatch,
			mpeState.Tracks,
		)
	}, checkAddingTracks)

	s.env.ExecuteWorkflow(MpeRoomWorkflow, params)

	s.True(s.env.IsWorkflowCompleted())
	err := s.env.GetWorkflowError()
	s.ErrorIs(err, workflow.ErrDeadlineExceeded, "The workflow ran on an infinite loop")
}

func TestEditingPlaylistTestSuite(t *testing.T) {
	suite.Run(t, new(EditingPlaylistTestSuite))
}
