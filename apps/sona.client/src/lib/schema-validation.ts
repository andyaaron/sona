/**
 * Runs a Standard Schema (our zod schemas from @sona/shared) inside a TanStack
 * Form function validator and maps issues onto field errors. Use it when the
 * form's value shape is a superset of the schema's input (e.g. one form that
 * serves two schemas) — passing the schema object directly requires an exact
 * type match. Structural type only, so the client needs no zod dependency.
 */
interface StandardIssue {
  message: string
  path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>
}

interface StandardResult {
  issues?: ReadonlyArray<StandardIssue>
}

export interface StandardSchemaLike {
  '~standard': {
    validate: (value: unknown) => StandardResult | Promise<StandardResult>
  }
}

export interface FieldErrorMap {
  fields: Record<string, string>
}

export async function validateWithSchema(
  schema: StandardSchemaLike,
  value: unknown,
): Promise<FieldErrorMap | undefined> {
  const result = await schema['~standard'].validate(value)
  if (!result.issues || result.issues.length === 0) return undefined

  const fields: Record<string, string> = {}
  for (const issue of result.issues) {
    const key = (issue.path ?? [])
      .map((segment) =>
        typeof segment === 'object' && segment !== null ? String(segment.key) : String(segment),
      )
      .join('.')
    // First message per field wins — matches how the field components render
    if (key && !(key in fields)) fields[key] = issue.message
  }
  return { fields }
}
