import BaseSeeder from '@ioc:Adonis/Lucid/Seeder';
import User from 'App/Models/User';
import faker, { datatype, internet } from 'faker';

faker.seed(42);

export default class UserSeeder extends BaseSeeder {
    public static developmentOnly = true;

    public async run(): Promise<void> {
        const uniqueKey = 'uuid';

        const users = await User.updateOrCreateMany(uniqueKey, [
            {
                uuid: 'f5ddbf01-cc01-4422-b347-67988342b558',
                nickname: 'Web',
            },
            {
                uuid: '9ed60e96-d5fc-40b3-b842-aeaa75e93972',
                nickname: 'Mobile',
            },

            // Copy-pasted from packages/client/e2e/home.spec.ts
            {
                uuid: '8d71dcb3-9638-4b7a-89ad-838e2310686c',
                nickname: 'Francis',
            },
            {
                uuid: '71bc3025-b765-4f84-928d-b4dca8871370',
                nickname: 'Moris',
            },
            {
                uuid: 'd125ecde-b0ee-4ab8-a488-c0e7a8dac7c5',
                nickname: 'Leila',
            },
            {
                uuid: '7f4bc598-c5be-4412-acc4-515a87b797e7',
                nickname: 'Manon',
            },

            ...Array.from({ length: 15 }).map(() => ({
                uuid: datatype.uuid(),
                nickname: `A${internet.userName()}`,
            })),
        ]);

        const famousUser = await User.create({
            uuid: '7d21f121-bed5-4c20-9da5-94746bbc8c08',
            nickname: 'Carole',
        });

        famousUser.related('followers').saveMany(users);
    }
}
