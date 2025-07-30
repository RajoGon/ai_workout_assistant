import app from ".";
import config from "./src/config/config";

app.listen(config.port, () => {
  console.log('App is listening on ', config.port)
})
