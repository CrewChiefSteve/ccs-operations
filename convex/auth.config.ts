export default {
  providers: [
    // Production — clerk.crewchiefsteve.ai
    {
      domain: "https://clerk.crewchiefsteve.ai",
      applicationID: "convex",
    },
    // Development — pk_test keys (giving-adder-21 instance)
    {
      domain: "https://giving-adder-21.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
