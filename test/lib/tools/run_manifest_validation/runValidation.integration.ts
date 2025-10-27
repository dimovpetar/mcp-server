import anyTest, {TestFn} from "ava";
import * as sinon from "sinon";
import esmock from "esmock";
import {readFile} from "fs/promises";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "..", "..", "..", "fixtures", "manifest_validation");

const test = anyTest as TestFn<{
	sinon: sinon.SinonSandbox;
	runValidation: typeof import("../../../../src/tools/run_manifest_validation/runValidation.js").default;
}>;

test.beforeEach(async (t) => {
	t.context.sinon = sinon.createSandbox();

	const schemaFixture = await readFile(path.join(fixturesPath, "schema.json"), "utf-8");
	const getManifestSchemaStub = t.context.sinon.stub().resolves(JSON.parse(schemaFixture));

	// Import the runValidation function
	t.context.runValidation = (await esmock(
		"../../../../src/tools/run_manifest_validation/runValidation.js", {
			"../../../../src/utils/ui5Manifest.js": {
				getManifestSchema: getManifestSchemaStub,
			},
		}
	)).default;
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("runValidation successfully validates valid manifest", async (t) => {
	const {runValidation} = t.context;

	const result = await runValidation(path.join(fixturesPath, "valid-manifest.json"));

	t.deepEqual(result, {
		isValid: true,
		errors: [],
	});
});
