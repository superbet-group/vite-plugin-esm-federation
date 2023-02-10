import { Button, Layout } from "antd";
import { render } from "react-dom";

import "antd/dist/antd.css";

// import { FederatedComponent } from "react-simple-remote/federated";

const FederatedComponent = lazy(() =>
  import("react-simple-remote/federated").then(({ FederatedComponent }) => ({
    default: FederatedComponent,
  }))
);

import styles from "./index.module.css";
import { lazy } from "react";
import { Suspense } from "react";

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
        <Suspense fallback={<div>Loading...</div>}>
          <FederatedComponent />
        </Suspense>
      </Layout.Content>
      <Layout.Footer>
        <div>Footer</div>
      </Layout.Footer>
    </Layout>
  );
};

render(<Host />, document.getElementById("main"));
