/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer'
|
*/
// import Redis from '@ioc:Adonis/Addons/Redis';
import Route from '@ioc:Adonis/Core/Route';

Route.get('/search/track/:query', 'TracksSearchesController.searchTrackName');

Route.post('/search/rooms', 'MtvRoomsHttpController.listAllRooms');

Route.get('/ping', () => console.log('pong'));

Route.get('/temporal/play/:roomID', 'Temporal/TemporalToServerController.play');

Route.get(
    '/temporal/pause/:roomID',
    'Temporal/TemporalToServerController.pause',
);

Route.post(
    '/temporal/join/:roomID/:userID',
    'Temporal/TemporalToServerController.join',
);

Route.get('/', () => {
    return { hello: 'world' };
});