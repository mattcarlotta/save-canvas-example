import get from "lodash/get";
import axios from "axios";

const app = axios.create({
  baseURL: process.env.REACT_APP_IMAGE_BASEURL,
});

app.interceptors.response.use(
  (response) => response,
  (error) =>
    Promise.reject(get(error, ["response", "data", "err"]) || error.message)
);

export default app;
