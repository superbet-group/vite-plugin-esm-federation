import { render } from "react-dom";

import { FederatedComponent } from "./Federated";
import { Button } from "./Button";
import { Private } from "./Private";

const Host = () => {
  return (
    <>
      <div>Hello World</div>
      <FederatedComponent />
      <Button />
      <Private />
    </>
  );
};

render(<Host />, document.getElementById("main"));
