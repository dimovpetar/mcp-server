import runValidation from "./runValidation.js";
import {inputSchema, outputSchema} from "./schema.js";
import {getLogger} from "@ui5/logger";
import Context from "../../Context.js";
import {RegisterTool} from "../../registerTools.js";

const log = getLogger("tools:run_manifest_validation");

export default function registerTool(registerTool: RegisterTool, _context: Context) {
	registerTool("run_manifest_validation", {
		description:
			"Validates UI5 manifest file." +
			"After making changes, you should always run the validation again " +
			"to verify that no new problems have been introduced.",
		annotations: {
			title: "Manifest Validation",
			readOnlyHint: false,
		},
		inputSchema,
		outputSchema,
	}, async ({manifestPath}) => {
		log.info(`Running manifest validation on ${manifestPath}...`);

		const result = await runValidation(manifestPath);

		return {
			content: [{
				type: "text",
				text: JSON.stringify(result),
			}],
			structuredContent: result,
		};
	});
}
