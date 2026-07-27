/**
 * Hostly intentionally does not seed public events.
 *
 * Events, ticket tiers, registrations, and check-ins must be created through
 * the real application flows so development data exercises the same
 * authorization and validation rules as production data.
 */
async function main(): Promise<void> {
  console.log(
    'No demo events were seeded. Sign up in Hostly and create an event through the workspace.',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
