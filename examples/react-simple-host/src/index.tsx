import { Button, Layout } from "antd";
import { Component, lazy, Suspense } from "react";
import { render } from "react-dom";

import "antd/dist/antd.css";

import styles from "./index.module.css";

// import { FederatedComponent } from "react-simple-remote/federated";
const FederatedComponent = lazy(() =>
  import("react-simple-remote/federated").then(({ FederatedComponent }) => ({
    default: FederatedComponent,
  }))
);

class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}

const Host = () => {
  return (
    <Layout>
      <Layout.Header
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ margin: 0 }}>Remote App</h1>
        <Button type="primary">Log in</Button>
      </Layout.Header>
      <Layout.Content className={styles.content}>
        <div>Hello World</div>
        <ErrorBoundary>
          <Suspense fallback={<div>Loading...</div>}>
            <FederatedComponent />
          </Suspense>
        </ErrorBoundary>
      </Layout.Content>
      <Layout.Footer>
        <div>Footer</div>
      </Layout.Footer>
    </Layout>
  );
};

render(<Host />, document.getElementById("main"));
