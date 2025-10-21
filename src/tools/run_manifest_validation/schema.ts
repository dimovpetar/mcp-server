import {z} from "zod";

export const inputSchema = {
	manifestPath: z.string()
		.describe("Path to the manifest file to validate."),
};

export const outputSchema = {
	isValid: z.boolean()
		.describe("Whether the manifest is valid according to the UI5 Manifest schema."),
	errors: z.array(
		z.object({
			keyword: z.string()
				.describe("Validation keyword."),
			instancePath: z.string()
				.describe("JSON Pointer to the location in the data instance (e.g., `/prop/1/subProp`)."),
			schemaPath: z.string()
				.describe("JSON Pointer to the location of the failing keyword in the schema."),
			params: z.record(z.any())
				.describe("An object with additional information about the error."),
			propertyName: z.string()
				.optional()
				.describe("Set for errors in `propertyNames` keyword schema."),
			message: z.string()
				.optional()
				.describe("The error message."),
			schema: z.any()
				.optional()
				.describe("The value of the failing keyword in the schema."),
			parentSchema: z.record(z.any())
				.optional()
				.describe("The schema containing the keyword."),
			data: z.any()
				.optional()
				.describe("The data validated by the keyword."),
		})
	).describe("Array of validation error objects as returned by Ajv."),

	// errors: z.array(
	// 	z.object({
	// 		path: z.array(
	// 			z.any()
	// 		).describe("An array of property keys or array offsets," +
	// 			"indicating where inside objects or arrays the instance was found"),
	// 		property: z.string()
	// 			.describe("Describes the property path. Starts with instance, and is delimited with a dot (.)"),
	// 		message: z.string()
	// 			.describe("A human-readable message for debugging use."),
	// 		instance: z.any()
	// 			.describe("The instance that failed"),
	// 		name: z.string()
	// 			.describe("The keyword within the schema that failed."),
	// 		argument: z.any()
	// 			.describe("Provides information about the keyword that failed."),
	// 		stack: z.string()
	// 			.describe("A human-readable string representing the error."),
	// 	}).describe("Single schema error object.")
	// ),
};
export const outputSchemaObject = z.object(outputSchema);
export type RunSchemaValidationResult = z.infer<typeof outputSchemaObject>;
