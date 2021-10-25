import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import Database from '@ioc:Adonis/Lucid/Database';
import {
    MtvRoomSearchRequestBody,
    MtvRoomSearchResponse,
    MtvRoomSummary,
} from '@musicroom/types';
import MtvRoom from 'App/Models/MtvRoom';
import MtvRoomInvitation from 'App/Models/MtvRoomInvitation';
import User from 'App/Models/User';

const MTV_ROOMS_SEARCH_LIMIT = 10;

export default class MtvRoomsHttpController {
    public async listAllRooms(): Promise<string[]> {
        const rooms = await MtvRoom.all();
        return rooms.map<string>((room) => room.uuid);
    }

    public async fetchMtvRooms({
        request,
    }: HttpContextContract): Promise<MtvRoomSearchResponse> {
        const rawBody = request.body();
        //TODO The userID raw in the request body is temporary
        //Later it will be a session cookie to avoid any security issues
        const { searchQuery, page, userID } =
            MtvRoomSearchRequestBody.parse(rawBody);

        /* eslint-disable @typescript-eslint/no-floating-promises */
        const roomsPagination = await Database.query()
            .select('*')
            .from(
                MtvRoom.query()
                    .preload('members')
                    .select(
                        'uuid as roomID',
                        'name as roomName',
                        'is_open as isOpen',
                        MtvRoomInvitation.query()
                            .where(
                                'mtv_room_invitations.invited_user_id',
                                userID,
                            )
                            .whereColumn(
                                'mtv_room_invitations.inviting_user_id',
                                'mtv_rooms.creator',
                            )
                            .whereColumn(
                                'mtv_room_invitations.mtv_room_id',
                                'mtv_rooms.uuid',
                            )
                            .select(`mtv_room_invitations.uuid`)
                            .as('invitationID'),
                        User.query()
                            .select('nickname')
                            .whereColumn('mtv_rooms.creator', 'users.uuid')
                            .as('creatorName'),
                    )
                    .where('name', 'ilike', `${searchQuery}%`)
                    .andWhereDoesntHave('members', (userQuery) => {
                        userQuery.where('uuid', userID);
                    })
                    .as('derivated_table'),
            )
            .where((query) => {
                query
                    .where('derivated_table.isOpen', false)
                    .andWhereNotNull('derivated_table.invitationID');
            })
            .orWhere('derivated_table.isOpen', true)
            .orderBy([
                {
                    column: 'derivated_table.isOpen',
                    order: 'asc',
                },
                {
                    column: 'derivated_table.invitationID',
                    order: 'asc',
                },
            ])
            .debug(true)
            .paginate(page, MTV_ROOMS_SEARCH_LIMIT);
        /* eslint-enable @typescript-eslint/no-floating-promises */

        const totalRoomsToLoad = roomsPagination.total;
        const hasMoreRoomsToLoad = roomsPagination.hasMorePages;
        const formattedRooms: MtvRoomSummary[] = roomsPagination
            .all()
            .map((room) => {
                const { invitationID, ...rest } = room;
                return MtvRoomSummary.parse({
                    ...rest,
                    isInvited: room.invitationID !== null,
                });
            });
        return {
            page,
            hasMore: hasMoreRoomsToLoad,
            totalEntries: totalRoomsToLoad,
            data: formattedRooms,
        };
    }
}
