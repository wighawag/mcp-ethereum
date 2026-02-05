import {Instance, Server} from 'prool';

export const anvilServer = Server.create({
	instance: Instance.anvil(),
	port: 5051,
});
