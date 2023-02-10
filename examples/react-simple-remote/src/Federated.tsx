import { Button } from "antd";
import { useCallback, useEffect, useState } from "react";

import styles from "./Federated.module.css";

export const FederatedComponent = () => {
  const [state, setState] = useState({ message: "" });

  const onClick = useCallback(() => {
    console.log("FederatedComponent: onClick");
    setState({ message: "Hello World" });
  }, []);

  useEffect(() => {
    console.log("FederatedComponent: useEffect");
  }, []);

  return (
    <div className={styles.container}>
      {state.message}
      <Button onClick={onClick}>I come from a different place</Button>
    </div>
  );
};
