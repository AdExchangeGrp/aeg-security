class LoggerMock {

	error (message) {

		console.log('error: ' + message);

	}

	errorWithMessage (message) {

		console.log('error: ' + message);

	}

	warn (message) {

		console.log('warn: ' + message);

	}

	verbose (message) {

		console.log('verbose: ' + message);

	}

	info (message) {

		console.log('info: ' + message);

	}

	debug (message) {

		console.log('debug: ' + message);

	}

}

export default LoggerMock;
