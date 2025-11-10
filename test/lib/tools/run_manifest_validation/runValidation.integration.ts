import anyTest, {TestFn} from "ava";
import * as sinon from "sinon";
import esmock from "esmock";
import {readFile} from "fs/promises";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "..", "..", "..", "fixtures", "manifest_validation");
const schemaFixture = JSON.parse(await readFile(path.join(fixturesPath, "schema.json"), "utf-8"));

const test = anyTest as TestFn<{
	sinon: sinon.SinonSandbox;
	runValidation: typeof import("../../../../src/tools/run_manifest_validation/runValidation.js").default;
	fetchCdnStub: sinon.SinonStub;
}>;

test.beforeEach(async (t) => {
	t.context.sinon = sinon.createSandbox();

	t.context.fetchCdnStub = t.context.sinon.stub();

	// Import the runValidation function with cdnHelper mocked globally
	t.context.runValidation = (await esmock(
		"../../../../src/tools/run_manifest_validation/runValidation.js",
		{},
		{
			"../../../../src/utils/cdnHelper.js": {
				fetchCdn: t.context.fetchCdnStub,
			},
		}
	)).default;
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("runValidation successfully validates valid manifest", async (t) => {
	const {runValidation, fetchCdnStub} = t.context;

	fetchCdnStub.withArgs("https://raw.githubusercontent.com/SAP/ui5-manifest/main/mapping.json")
		.resolves({
			"1.59.0": "1.59.0",
		});

	fetchCdnStub.withArgs("https://raw.githubusercontent.com/SAP/ui5-manifest/v1.59.0/schema.json")
		.resolves(schemaFixture);

	const result = await runValidation(path.join(fixturesPath, "valid-manifest.json"));

	t.deepEqual(result, {
		isValid: true,
		errors: [],
	});
});

test("runValidation successfully validates valid manifest after first attempt ending with exception", async (t) => {
	const {runValidation, fetchCdnStub} = t.context;

	fetchCdnStub.withArgs("https://raw.githubusercontent.com/SAP/ui5-manifest/main/mapping.json")
		.resolves({
			"1.59.0": "1.59.0",
		});

	fetchCdnStub.withArgs("https://raw.githubusercontent.com/SAP/ui5-manifest/v1.59.0/schema.json")
		.resolves(schemaFixture);

	await t.throwsAsync(async () => {
		await runValidation(path.join(fixturesPath, "missing-version-manifest.json"));
	}, {
		message: "Manifest does not contain a '_version' property.",
	});

	const result = await runValidation(path.join(fixturesPath, "valid-manifest.json"));

	t.deepEqual(result, {
		isValid: true,
		errors: [],
	});
});

test("runValidation successfully validates valid manifest after first attempt ending with schema fetch error",
	async (t) => {
		const {runValidation, fetchCdnStub} = t.context;

		fetchCdnStub.withArgs("https://raw.githubusercontent.com/SAP/ui5-manifest/main/mapping.json")
			.resolves({
				"1.59.0": "1.59.0",
			});

		fetchCdnStub.withArgs("https://raw.githubusercontent.com/SAP/ui5-manifest/v1.59.0/schema.json")
			.onFirstCall()
			.rejects(new Error("Failed to fetch schema"))
			.onSecondCall()
			.resolves(schemaFixture);

		await t.throwsAsync(async () => {
			await runValidation(path.join(fixturesPath, "valid-manifest.json"));
		}, {
			message: "Failed to fetch schema for manifest version '1.59.0': Failed to fetch schema",
		});

		const result = await runValidation(path.join(fixturesPath, "valid-manifest.json"));

		t.deepEqual(result, {
			isValid: true,
			errors: [],
		});
	}
);
