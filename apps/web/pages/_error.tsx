// Custom Pages Router error page.
// This minimal page prevents the default Next.js _error from being generated,
// which would import modules that call useContext during static prerendering
// and fail in the monorepo environment.
function ErrorPage() {
  return (
    <div style={{ fontFamily: "system-ui", textAlign: "center", padding: "4rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Something went wrong</h1>
      <p>Please try refreshing the page.</p>
    </div>
  );
}

ErrorPage.getInitialProps = () => {
  return {};
};

export default ErrorPage;
