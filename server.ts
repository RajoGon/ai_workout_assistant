import app from ".";
import config from "./src/config/config";

app.listen(config.PORT, () => {
  console.log('App is listening on ', config.PORT)
})
