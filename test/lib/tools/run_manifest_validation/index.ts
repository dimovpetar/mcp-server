import anyTest, {TestFn} from "ava";
import esmock from "esmock";
import sinonGlobal from "sinon";
import TestContext from "../../../utils/TestContext.js";

// Define test context type
const test = anyTest as TestFn<{
	sinon: sinonGlobal.SinonSandbox;
	registerToolCallback: sinonGlobal.SinonStub;
	loggerMock: {
		silly: sinonGlobal.SinonStub;
		verbose: sinonGlobal.SinonStub;
		perf: sinonGlobal.SinonStub;
		info: sinonGlobal.SinonStub;
		warn: sinonGlobal.SinonStub;
		error: sinonGlobal.SinonStub;
		isLevelEnabled: sinonGlobal.SinonStub;
	};
	runValidationStub: sinonGlobal.SinonStub;
	registerRunManifestValidationTool: typeof import(
		"../../../../src/tools/run_manifest_validation/index.js"
	).default;
}>;

// Setup test context before each test
test.beforeEach(async (t) => {
	// Create a sandbox for sinon stubs
	t.context.sinon = sinonGlobal.createSandbox();

	t.context.registerToolCallback = t.context.sinon.stub();

	// Create logger mock
	const loggerMock = {
		silly: t.context.sinon.stub(),
		verbose: t.context.sinon.stub(),
		perf: t.context.sinon.stub(),
		info: t.context.sinon.stub(),
		warn: t.context.sinon.stub(),
		error: t.context.sinon.stub(),
		isLevelEnabled: t.context.sinon.stub().returns(true),
	};
	t.context.loggerMock = loggerMock;

	const runValidationStub = t.context.sinon.stub();
	t.context.runValidationStub = runValidationStub;

	// Import the tool registration function with mocked dependencies
	const {default: registerRunManifestValidationTool} = await esmock(
		"../../../../src/tools/run_manifest_validation/index.js", {
			"../../../../src/tools/run_manifest_validation/runValidation.js": {
				default: runValidationStub,
			},
		}
	);

	t.context.registerRunManifestValidationTool = registerRunManifestValidationTool;
});

// Clean up after each test
test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("registerRunManifestValidationTool registers the tool with correct parameters", (t) => {
	const {registerToolCallback, registerRunManifestValidationTool} = t.context;

	registerRunManifestValidationTool(registerToolCallback, new TestContext());

	t.true(registerToolCallback.calledOnce);
	t.is(registerToolCallback.firstCall.args[0], "run_manifest_validation");

	// Verify tool configuration
	const toolConfig = registerToolCallback.firstCall.args[1];
	t.true(toolConfig?.title?.includes("Manifest Validation"));
	t.true(toolConfig?.description?.includes("Validates UI5 manifest file"));
	t.is(toolConfig?.annotations?.title, "Manifest Validation");
	t.false(toolConfig?.annotations?.readOnlyHint);
});

test("run_manifest_validation tool returns validation result on success", async (t) => {
	const {
		registerToolCallback,
		registerRunManifestValidationTool,
		runValidationStub,
	} = t.context;

	// Setup runValidation to return a sample result
	const sampleResult = {
		valid: true,
		issues: [],
	};
	runValidationStub.resolves(sampleResult);

	// Register the tool and capture the execute function
	registerRunManifestValidationTool(registerToolCallback, new TestContext());
	const executeFunction = registerToolCallback.firstCall.args[2];

	const mockExtra = {
		signal: new AbortController().signal,
		requestId: "test-request-id",
		sendNotification: t.context.sinon.stub(),
		sendRequest: t.context.sinon.stub(),
	};

	// Execute the tool
	const manifestPath = "/path/to/valid/manifest.json";
	const result = await executeFunction({manifestPath}, mockExtra);

	t.deepEqual(result, {
		content: [{
			type: "text",
			text: JSON.stringify(sampleResult),
		}],
		structuredContent: sampleResult,
	});
});

test("run_manifest_validation tool handles errors correctly", async (t) => {
	const {
		registerToolCallback,
		registerRunManifestValidationTool,
		runValidationStub,
	} = t.context;

	// Setup readFile to throw an error
	const errorMessage = "Failed to read manifest file";
	runValidationStub.rejects(new Error(errorMessage));

	// Register the tool and capture the execute function
	registerRunManifestValidationTool(registerToolCallback, new TestContext());
	const executeFunction = registerToolCallback.firstCall.args[2];

	const mockExtra = {
		signal: new AbortController().signal,
		requestId: "test-request-id",
		sendNotification: t.context.sinon.stub(),
		sendRequest: t.context.sinon.stub(),
	};

	// Execute the tool
	const manifestPath = "/path/to/invalid/manifest.json";
	await t.throwsAsync(async () => {
		await executeFunction({manifestPath}, mockExtra);
	}, {
		message: errorMessage,
	});
});
