import {fetchCdn} from "../../utils/cdnHelper.js";
import {RunSchemaValidationResult} from "./schema.js";
import Ajv2020, {AnySchemaObject} from "ajv/dist/2020.js";
import {readFile} from "fs/promises";
import {getLogger} from "@ui5/logger";
import {InvalidInputError} from "../../utils.js";

const log = getLogger("tools:run_manifest_validation:runValidation");
const schemaCache = new Map<string, Promise<object>>();

async function createUI5ManifestValidateFunction() {
	const ajv = new Ajv2020.default({
		allErrors: true, // Collect all errors, not just the first one
		strict: false, // Allow additional properties that are not in schema
		unicodeRegExp: false,
		loadSchema: async (uri) => {
			// Check cache first to prevent infinite loops
			if (schemaCache.has(uri)) {
				log.info(`Loading cached schema: ${uri}`);

				try {
					const schema = await schemaCache.get(uri)!;
					return schema;
				} catch {
					schemaCache.delete(uri);
				}
			}

			log.info(`Loading external schema: ${uri}`);
			let fetchSchema: Promise<object>;

			try {
				if (uri.includes("adaptive-card.json")) {
					// Special handling for Adaptive Card schema to fix unsupported "id" property
					// According to the JSON Schema spec Draft 06 (used by Adaptive Card schema),
					// "$id" should be used instead of "id"
					fetchSchema = fetchCdn(uri)
						.then((response) => {
							if ("id" in response && typeof response.id === "string") {
								const typedResponse = response as Record<string, unknown>;
								typedResponse.$id = response.id;
								delete typedResponse.id;
							}
							return response;
						});
				} else {
					fetchSchema = fetchCdn(uri);
				}

				schemaCache.set(uri, fetchSchema);
				return fetchSchema;
			} catch (error) {
				log.warn(`Failed to load external schema ${uri}:` +
					`${error instanceof Error ? error.message : String(error)}`);

				throw error;
			}
		},
	});
	const draft06MetaSchema = JSON.parse(
		await readFile("node_modules/ajv/dist/refs/json-schema-draft-06.json", "utf-8")
	) as AnySchemaObject;
	const draft07MetaSchema = JSON.parse(
		await readFile("node_modules/ajv/dist/refs/json-schema-draft-07.json", "utf-8")
	) as AnySchemaObject;

	ajv.addMetaSchema(draft06MetaSchema, "http://json-schema.org/draft-06/schema#");
	ajv.addMetaSchema(draft07MetaSchema, "http://json-schema.org/draft-07/schema#");

	// Fetch the UI5 manifest schema
	const schemaUrl = "https://raw.githubusercontent.com/SAP/ui5-manifest/master/schema.json";
	const schema = await fetchCdn(schemaUrl);
	log.info(`Fetched UI5 manifest schema from ${schemaUrl}`);

	const validate = await ajv.compileAsync(schema);

	return validate;
}

async function readManifest(path: string) {
	let content: string;
	let json: object;

	try {
		content = await readFile(path, "utf-8");
	} catch (error) {
		throw new InvalidInputError(`Failed to read manifest file at ${path}: ` +
			`${error instanceof Error ? error.message : String(error)}`);
	}

	try {
		json = JSON.parse(content) as object;
	} catch (error) {
		throw new InvalidInputError(`Failed to parse manifest file at ${path} as JSON: ` +
			`${error instanceof Error ? error.message : String(error)}`);
	}

	return json;
}

export default async function runValidation(manifestPath: string): Promise<RunSchemaValidationResult> {
	log.info(`Starting manifest validation for file: ${manifestPath}`);

	const manifest = await readManifest(manifestPath);
	const validate = await createUI5ManifestValidateFunction();
	const isValid = validate(manifest);

	if (isValid) {
		log.info("Manifest validation successful");

		return {
			isValid: true,
			errors: [],
		};
	}

	// Map AJV errors to our schema format
	const validationErrors = validate.errors ?? [];
	const errors = validationErrors.map((error) => {
		return {
			keyword: error.keyword ?? "",
			instancePath: error.instancePath ?? "",
			schemaPath: error.schemaPath ?? "",
			params: error.params ?? {},
			propertyName: error.propertyName,
			message: error.message,
			schema: error.schema,
			parentSchema: error.parentSchema,
			data: error.data,
		};
	});

	log.info(`Manifest validation failed with ${errors.length} error(s)`);

	return {
		isValid: false,
		errors: errors,
	};
}
