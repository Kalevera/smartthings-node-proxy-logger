# smartthings-node-proxy-logger

```git clone https://github.com/Kalevera/smartthings-node-proxy-logger.git``` repository into smartthings-node-proxy server folder

change directory into the new smartthings-node-proxy-logger folder
``` npm install ``` then ``` npm link ``` this will install the dependencies and will do a local npm link of the module this is so you can use ```require``` syntax in the server.js file and plugin file
```
var STL = require('smartthings-node-proxy-logger'); //STL - Smartthings Logger
const logger = new STL(__dirname,'mod'); // where mod is the location of the logger (i.e. stnp, or evl3, etc...)
```
replace the instances of ```logger``` with ```logger.log()```
### note 
```logger.log()``` is an error first module therefore it needs a null identifier on general logs and nothing on errors.

### usage
```
//log an error
logger.log('some error we want to track in our smartthings-node-proxy server')

//log a general message such as accessing the logs or errorlogs etc.
logger.log(null,'this is a general message that we want to track and will be notified of the message via email')

```

### modification to config file

must add the following to the config file to recieve emails and to expect a threshold for log files to be reduced in size
{
  "maxLogSizeBytes":"12400",  // 12.4kbs                 
  "mailkey" :"Insert Mailgun key", //this relies on mailgun and mailgun API, find the key in your www.mailgun.com dashboard
  "maildomain":"Insert Mailgun domain", //find the sandbox domain or an authroized domain in your www.mailgun.com dashboard
  "myEmail":"Insert the email that is getting notifications" //if using sandbox you'll need to verify the email on mailgun dashboard
  }
