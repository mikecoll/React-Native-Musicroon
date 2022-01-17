import Database from '@ioc:Adonis/Lucid/Database';
import { datatype, lorem } from 'faker';
import test from 'japa';
import sinon from 'sinon';
import supertest from 'supertest';
import {
    ListAllMpeRoomsRequestBody,
    ListAllMpeRoomsResponseBody,
    MpeSearchMyRoomsRequestBody,
    MpeSearchMyRoomsResponseBody,
} from '@musicroom/types';
import MpeRoom from 'App/Models/MpeRoom';
import { BASE_URL, initTestUtils, generateArray } from './utils/TestUtils';

test.group('My MPE Rooms Search', (group) => {
    const {
        createUserAndGetSocket,
        disconnectEveryRemainingSocketConnection,
        initSocketConnection,
    } = initTestUtils();

    group.beforeEach(async () => {
        initSocketConnection();
        await Database.beginGlobalTransaction();
    });

    group.afterEach(async () => {
        await disconnectEveryRemainingSocketConnection();
        sinon.restore();
        await Database.rollbackGlobalTransaction();
    });

    test('It should send back mpe room user has joined only', async (assert) => {
        const userID = datatype.uuid();
        const mpeRooms = generateArray({
            fill: () => ({
                roomName: lorem.sentence(),
                roomID: datatype.uuid(),
            }),
            minLength: 3,
            maxLength: 10,
        });
        const otherMpeRooms = generateArray({
            fill: () => ({
                roomName: lorem.sentence(),
                roomID: datatype.uuid(),
            }),
            minLength: 3,
            maxLength: 10,
        });

        await createUserAndGetSocket({
            userID: datatype.uuid(),
            mpeRoomIDToAssociate: otherMpeRooms,
        });

        await createUserAndGetSocket({
            userID,
            mpeRoomIDToAssociate: mpeRooms,
        });

        const requestBody: MpeSearchMyRoomsRequestBody = {
            userID,
            searchQuery: '',
            page: 1,
        };
        const { body } = await supertest(BASE_URL)
            .post('/mpe/search/my-rooms')
            .send(requestBody)
            .expect('Content-Type', /json/)
            .expect(200);
        const parsedBody = MpeSearchMyRoomsResponseBody.parse(body);

        assert.equal(parsedBody.data.length, mpeRooms.length);
    });

    test('It should fail to search not existing user mpe rooms', async () => {
        const userID = datatype.uuid();
        const mpeRooms = generateArray({
            fill: () => ({
                roomName: lorem.sentence(),
                roomID: datatype.uuid(),
            }),
            minLength: 3,
            maxLength: 10,
        });
        const otherMpeRooms = generateArray({
            fill: () => ({
                roomName: lorem.sentence(),
                roomID: datatype.uuid(),
            }),
            minLength: 3,
            maxLength: 10,
        });

        await createUserAndGetSocket({
            userID: datatype.uuid(),
            mpeRoomIDToAssociate: otherMpeRooms,
        });

        await createUserAndGetSocket({
            userID,
            mpeRoomIDToAssociate: mpeRooms,
        });

        const unknownUserID = datatype.uuid();

        const requestBody: MpeSearchMyRoomsRequestBody = {
            userID: unknownUserID,
            searchQuery: '',
            page: 1,
        };
        await supertest(BASE_URL)
            .post('/mpe/search/my-rooms')
            .send(requestBody)
            .expect(404);
    });

    test('Returns only rooms matching partial search query', async (assert) => {
        const userID = datatype.uuid();
        const mpeRooms: {
            roomName: string;
            roomID: string;
        }[] = [
            {
                roomID: datatype.uuid(),
                roomName: 'Biolay Playlist',
            },
            {
                roomID: datatype.uuid(),
                roomName: 'Hubert-Félix Thiéfaine Playlist',
            },
            {
                roomID: datatype.uuid(),
                roomName: 'Muse Playlist',
            },
        ];
        const firstMpeRoom = mpeRooms[0];

        await createUserAndGetSocket({
            userID,
            mpeRoomIDToAssociate: mpeRooms,
        });

        const searchQuery = firstMpeRoom.roomName.slice(0, 3);
        const requestBody: MpeSearchMyRoomsRequestBody = {
            userID,
            searchQuery,
            page: 1,
        };
        const { body } = await supertest(BASE_URL)
            .post('/mpe/search/my-rooms')
            .send(requestBody)
            .expect('Content-Type', /json/)
            .expect(200);
        const parsedBody = MpeSearchMyRoomsResponseBody.parse(body);

        assert.equal(parsedBody.data.length, 1);
        assert.equal(parsedBody.data[0].roomName, firstMpeRoom.roomName);
    });

    test('Returns only rooms matching case insensitive search query', async (assert) => {
        const userID = datatype.uuid();
        const mpeRooms: {
            roomName: string;
            roomID: string;
        }[] = [
            {
                roomID: datatype.uuid(),
                roomName: 'Biolay Playlist',
            },
            {
                roomID: datatype.uuid(),
                roomName: 'Hubert-Félix Thiéfaine Playlist',
            },
            {
                roomID: datatype.uuid(),
                roomName: 'Muse Playlist',
            },
        ];
        const firstMpeRoom = mpeRooms[0];

        await createUserAndGetSocket({
            userID,
            mpeRoomIDToAssociate: mpeRooms,
        });

        const searchQuery = firstMpeRoom.roomName.toLowerCase();
        const requestBody: MpeSearchMyRoomsRequestBody = {
            userID,
            searchQuery,
            page: 1,
        };
        const { body } = await supertest(BASE_URL)
            .post('/mpe/search/my-rooms')
            .send(requestBody)
            .expect('Content-Type', /json/)
            .expect(200);
        const parsedBody = MpeSearchMyRoomsResponseBody.parse(body);

        assert.equal(parsedBody.data.length, 1);
        assert.equal(parsedBody.data[0].roomName, firstMpeRoom.roomName);
    });

    test('Page must be strictly positive', async () => {
        const requestBody: MpeSearchMyRoomsRequestBody = {
            userID: datatype.uuid(),
            searchQuery: '',
            page: 0,
        };
        await supertest(BASE_URL)
            .post('/mpe/search/my-rooms')
            .send(requestBody)
            .expect(500);
    });

    test('Rooms are paginated', async (assert) => {
        const PAGE_MAX_LENGTH = 10;
        const userID = datatype.uuid();
        const mpeRooms = generateArray({
            fill: () => ({
                roomName: lorem.sentence(),
                roomID: datatype.uuid(),
            }),
            minLength: 11,
            maxLength: 22,
        });
        const totalRoomsCount = mpeRooms.length;

        await createUserAndGetSocket({
            userID: userID,
            mpeRoomIDToAssociate: mpeRooms,
        });

        let page = 1;
        let hasMore = true;
        let totalFetchedEntries = 0;
        while (hasMore === true) {
            const requestBody: MpeSearchMyRoomsRequestBody = {
                userID,
                searchQuery: '',
                page,
            };

            const { body: pageBodyRaw } = await supertest(BASE_URL)
                .post('/mpe/search/my-rooms')
                .send(requestBody)
                .expect('Content-Type', /json/)
                .expect(200);
            const pageBodyParsed =
                MpeSearchMyRoomsResponseBody.parse(pageBodyRaw);

            assert.equal(pageBodyParsed.page, page);
            assert.equal(pageBodyParsed.totalEntries, totalRoomsCount);
            assert.isAtMost(pageBodyParsed.data.length, PAGE_MAX_LENGTH);

            totalFetchedEntries += pageBodyParsed.data.length;
            hasMore = pageBodyParsed.hasMore;
            page++;
        }

        assert.equal(totalFetchedEntries, totalRoomsCount);

        const extraRequestBody: MpeSearchMyRoomsRequestBody = {
            userID,
            searchQuery: '',
            page,
        };
        const { body: extraPageBodyRaw } = await supertest(BASE_URL)
            .post('/mpe/search/my-rooms')
            .send(extraRequestBody)
            .expect('Content-Type', /json/)
            .expect(200);
        const extraPageBodyParsed =
            MpeSearchMyRoomsResponseBody.parse(extraPageBodyRaw);

        assert.equal(extraPageBodyParsed.page, page);
        assert.equal(extraPageBodyParsed.totalEntries, totalRoomsCount);
        assert.equal(extraPageBodyParsed.data.length, 0);
        assert.isFalse(extraPageBodyParsed.hasMore);
    });
});

test.group('All MPE Rooms Search', (group) => {
    const {
        createUserAndGetSocket,
        disconnectEveryRemainingSocketConnection,
        initSocketConnection,
    } = initTestUtils();

    group.beforeEach(async () => {
        initSocketConnection();
        await Database.beginGlobalTransaction();
    });

    group.afterEach(async () => {
        await disconnectEveryRemainingSocketConnection();
        sinon.restore();
        await Database.rollbackGlobalTransaction();
    });

    test('Does not return rooms user is member of', async (assert) => {
        const userID = datatype.uuid();
        const mpeRooms = generateArray({
            fill: () => ({
                roomName: lorem.sentence(),
                roomID: datatype.uuid(),
            }),
            minLength: 3,
            maxLength: 9,
        });

        await createUserAndGetSocket({
            userID,
            mpeRoomIDToAssociate: mpeRooms,
        });

        const requestBody: ListAllMpeRoomsRequestBody = {
            userID,
            searchQuery: '',
            page: 1,
        };
        const { body } = await supertest(BASE_URL)
            .post('/mpe/search/all-rooms')
            .send(requestBody)
            .expect('Content-Type', /json/)
            .expect(200);
        const parsedBody = ListAllMpeRoomsResponseBody.parse(body);

        assert.isEmpty(parsedBody.data);
        assert.isFalse(parsedBody.hasMore);
        assert.equal(parsedBody.totalEntries, 0);
        assert.equal(parsedBody.page, 1);
    });

    test('Returns only rooms matching partial search query', async (assert) => {
        const userID = datatype.uuid();
        const mpeRooms: {
            roomName: string;
            roomID: string;
        }[] = [
            {
                roomID: datatype.uuid(),
                roomName: 'Biolay Playlist',
            },
            {
                roomID: datatype.uuid(),
                roomName: 'Hubert-Félix Thiéfaine Playlist',
            },
            {
                roomID: datatype.uuid(),
                roomName: 'Muse Playlist',
            },
        ];
        const firstMpeRoom = mpeRooms[0];

        await createUserAndGetSocket({
            userID: datatype.uuid(),
            mpeRoomIDToAssociate: mpeRooms,
        });

        await createUserAndGetSocket({
            userID,
        });

        const searchQuery = firstMpeRoom.roomName.slice(0, 3);
        const requestBody: ListAllMpeRoomsRequestBody = {
            userID,
            searchQuery,
            page: 1,
        };
        const { body } = await supertest(BASE_URL)
            .post('/mpe/search/all-rooms')
            .send(requestBody)
            .expect('Content-Type', /json/)
            .expect(200);
        const parsedBody = ListAllMpeRoomsResponseBody.parse(body);

        assert.equal(parsedBody.data.length, 1);
        assert.equal(parsedBody.data[0].roomName, firstMpeRoom.roomName);
    });

    test('Returns only rooms matching case insensitive search query', async (assert) => {
        const userID = datatype.uuid();
        const mpeRooms: {
            roomName: string;
            roomID: string;
        }[] = [
            {
                roomID: datatype.uuid(),
                roomName: 'Biolay Playlist',
            },
            {
                roomID: datatype.uuid(),
                roomName: 'Hubert-Félix Thiéfaine Playlist',
            },
            {
                roomID: datatype.uuid(),
                roomName: 'Muse Playlist',
            },
        ];
        const firstMpeRoom = mpeRooms[0];

        await createUserAndGetSocket({
            userID: datatype.uuid(),
            mpeRoomIDToAssociate: mpeRooms,
        });

        await createUserAndGetSocket({
            userID,
        });

        const searchQuery = firstMpeRoom.roomName.toLowerCase();
        const requestBody: ListAllMpeRoomsRequestBody = {
            userID,
            searchQuery,
            page: 1,
        };
        const { body } = await supertest(BASE_URL)
            .post('/mpe/search/all-rooms')
            .send(requestBody)
            .expect('Content-Type', /json/)
            .expect(200);
        const parsedBody = ListAllMpeRoomsResponseBody.parse(body);

        assert.equal(parsedBody.data.length, 1);
        assert.equal(parsedBody.data[0].roomName, firstMpeRoom.roomName);
    });

    test('Page must be strictly positive', async () => {
        const userID = datatype.uuid();
        const requestBody: ListAllMpeRoomsRequestBody = {
            userID,
            searchQuery: '',
            page: 0,
        };
        await supertest(BASE_URL)
            .post('/mpe/search/all-rooms')
            .send(requestBody)
            .expect(500);
    });

    test('All rooms are paginated', async (assert) => {
        const PAGE_MAX_LENGTH = 10;
        const userID = datatype.uuid();

        const mpeRooms = generateArray({
            fill: () => ({
                roomName: lorem.sentence(),
                roomID: datatype.uuid(),
            }),
            minLength: 22,
            maxLength: 36,
        });
        const totalRoomsCount = mpeRooms.length;

        await createUserAndGetSocket({
            userID: datatype.uuid(),
            mpeRoomIDToAssociate: mpeRooms,
        });

        await createUserAndGetSocket({
            userID,
        });

        let page = 1;
        let hasMore = true;
        let totalFetchedEntries = 0;
        while (hasMore === true) {
            const requestBody: ListAllMpeRoomsRequestBody = {
                userID,
                searchQuery: '',
                page,
            };
            const { body: pageBodyRaw } = await supertest(BASE_URL)
                .post('/mpe/search/all-rooms')
                .send(requestBody)
                .expect('Content-Type', /json/)
                .expect(200);
            const pageBodyParsed =
                ListAllMpeRoomsResponseBody.parse(pageBodyRaw);

            assert.equal(pageBodyParsed.page, page);
            assert.equal(pageBodyParsed.totalEntries, totalRoomsCount);
            assert.isAtMost(pageBodyParsed.data.length, PAGE_MAX_LENGTH);

            totalFetchedEntries += pageBodyParsed.data.length;
            hasMore = pageBodyParsed.hasMore;
            page++;
        }

        assert.equal(totalFetchedEntries, totalRoomsCount);

        const extraRequestBody: ListAllMpeRoomsRequestBody = {
            userID,
            searchQuery: '',
            page,
        };
        const { body: extraPageBodyRaw } = await supertest(BASE_URL)
            .post('/mpe/search/all-rooms')
            .send(extraRequestBody)
            .expect('Content-Type', /json/)
            .expect(200);
        const extraPageBodyParsed =
            ListAllMpeRoomsResponseBody.parse(extraPageBodyRaw);

        assert.equal(extraPageBodyParsed.page, page);
        assert.equal(extraPageBodyParsed.totalEntries, totalRoomsCount);
        assert.equal(extraPageBodyParsed.data.length, 0);
        assert.isFalse(extraPageBodyParsed.hasMore);
    });

    test('Rooms should be ordered by private room first, public but invited room in second and then some public rooms', async (assert) => {
        const PAGE_MAX_LENGTH = 10;
        const userID = datatype.uuid();
        const inviterUserID = datatype.uuid();

        await createUserAndGetSocket({
            userID: inviterUserID,
        });

        await createUserAndGetSocket({
            userID,
        });

        const privateMpeRoomsWithInvitation = await MpeRoom.createMany(
            generateArray({
                fill: () => ({
                    uuid: datatype.uuid(),
                    runID: datatype.uuid(),
                    name: lorem.sentence(),
                    creatorID: inviterUserID,
                    isOpen: false,
                }),
                minLength: 5,
                maxLength: 5,
            }),
        );
        for (const room of privateMpeRoomsWithInvitation) {
            await room.related('invitations').create({
                invitingUserID: inviterUserID,
                invitedUserID: userID,
            });
        }

        const openMpeRoomsWithInvitation = await MpeRoom.createMany(
            generateArray({
                fill: () => ({
                    uuid: datatype.uuid(),
                    runID: datatype.uuid(),
                    name: lorem.sentence(),
                    creatorID: inviterUserID,
                    isOpen: true,
                }),
                minLength: 5,
                maxLength: 5,
            }),
        );
        for (const room of openMpeRoomsWithInvitation) {
            await room.related('invitations').create({
                invitingUserID: inviterUserID,
                invitedUserID: userID,
            });
        }

        const openMpeRoomsWithoutInvitation = await MpeRoom.createMany(
            generateArray({
                fill: () => ({
                    uuid: datatype.uuid(),
                    runID: datatype.uuid(),
                    name: lorem.sentence(),
                    creatorID: inviterUserID,
                    isOpen: true,
                }),
                minLength: 5,
                maxLength: 5,
            }),
        );

        const expectedMpeRoomsIDToBeReturnedInOrder = [
            ...privateMpeRoomsWithInvitation.map((room) => room.uuid).sort(),
            ...openMpeRoomsWithInvitation.map((room) => room.uuid).sort(),
            ...openMpeRoomsWithoutInvitation.map((room) => room.uuid).sort(),
        ];
        const totalRoomsCount = expectedMpeRoomsIDToBeReturnedInOrder.length;

        let page = 1;
        let hasMore = true;
        const fetchedRoomsIDs: string[] = [];
        while (hasMore === true) {
            const requestBody: ListAllMpeRoomsRequestBody = {
                userID,
                searchQuery: '',
                page,
            };
            const { body: pageBodyRaw } = await supertest(BASE_URL)
                .post('/mpe/search/all-rooms')
                .send(requestBody)
                .expect('Content-Type', /json/)
                .expect(200);
            const pageBodyParsed =
                ListAllMpeRoomsResponseBody.parse(pageBodyRaw);

            assert.equal(pageBodyParsed.page, page);
            assert.equal(pageBodyParsed.totalEntries, totalRoomsCount);
            assert.isAtMost(pageBodyParsed.data.length, PAGE_MAX_LENGTH);

            fetchedRoomsIDs.push(
                ...pageBodyParsed.data.map((room) => room.roomID),
            );
            hasMore = pageBodyParsed.hasMore;
            page++;
        }

        assert.deepEqual(
            fetchedRoomsIDs,
            expectedMpeRoomsIDToBeReturnedInOrder,
        );

        const extraRequestBody: ListAllMpeRoomsRequestBody = {
            userID,
            searchQuery: '',
            page,
        };
        const { body: extraPageBodyRaw } = await supertest(BASE_URL)
            .post('/mpe/search/all-rooms')
            .send(extraRequestBody)
            .expect('Content-Type', /json/)
            .expect(200);
        const extraPageBodyParsed =
            ListAllMpeRoomsResponseBody.parse(extraPageBodyRaw);

        assert.equal(extraPageBodyParsed.page, page);
        assert.equal(extraPageBodyParsed.totalEntries, totalRoomsCount);
        assert.equal(extraPageBodyParsed.data.length, 0);
        assert.isFalse(extraPageBodyParsed.hasMore);
    });
});
