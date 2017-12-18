var fs = require('fs');
var chokidar = require('chokidar');
var nconf = require('nconf');
nconf.file({ file: './config.json' });
var mailgun = require("mailgun-js")({apiKey: nconf.get('mailkey'),domain:nconf.get('maildomain')});


module.exports = Logger;

function Logger(dirname,modname){
  if(typeof dirname != 'string') throw new Error('Logger module first aregument must must be a filename as a string, you can use __dirname as well');
  this.dirname = dirname;
  this.logFileWatcher = null;
  this.modname = modname;
  this.sendingGenEmail = false;
  this.sendingErrorEmail = false;
  this.lastErrorEmailTime = new Date();
  this.lastLogEmailTime = new Date();

  this.log = function log(err,str) {

    const mod = this.modname;
    const logTimeStamp = new Date().toISOString();
    const opts = {
        flags : 'a',
        autoclose: true
      }
    if(err){
      var errorString = 'looks like an error message wasn\'t written into the system for this error';
      if(typeof err === 'object'){
        //check if the error is coming from non existent file
        if(err.code === 'ENOENT' && err.syscall && err.path){
          errorString = "Error: "+ err.code + ": " +"no such file or directory, "+ err.syscall + " "+err.path;
        }else{
          //if not an error we were looking for still log the error object.
          errorString = JSON.stringify(err);  
        }
      }else{
        // We're assuming this is a custom string error that was coded in the original logger.
        errorString = err;
      }
      writestream = fs.createWriteStream('error_log.txt',opts);
      writestream.open();
      writestream.write(logTimeStamp + ': [' + mod + '] ');
      writestream.write(errorString);
      writestream.end('\r\n');
      //this.setupEmailNotification('error_log.txt');
    }else{
      writestream = fs.createWriteStream('general_log.txt',opts);
      writestream.open();
      writestream.write(logTimeStamp + ': [' + mod + '] ');
      writestream.write(str);
      writestream.end('\r\n');
      
    }
    this.fileWatchComponent((path,param)=>{
      if(param) this.setupEmailNotification(path)
    });
  }
  this.setupEmailNotification = function setupEmailNotification(path){

    const currentTime = new Date();
    const fileText = fs.readFileSync(path);
    const data = {
      from: 'SmartThings Logger <homeSTL@sample.mailgun.org>',
      to: nconf.get('myEmail'),
      subject:'Smartthings Log File; Type: '+ path,
      text:  fileText.toString()
    }
    if(!this.lastLogEmailTime) this.lastLogEmailTime = new Date(); 
    if(!this.lastErrorEmailTime) this.lastErrorEmailTime = new Date();
    if(path === 'general_log.txt'){
      //24hours 60000*60*24
      if(currentTime.getTime() - this.lastLogEmailTime.getTime() >= (60000*60*24) && !this.sendingGenEmail){
        this.sendEmailNotification(path,data);
        this.sendingGenEmail = true;
      }
    }else{
      //1hour 60000*60
      if(currentTime.getTime() - this.lastErrorEmailTime.getTime() >= (60000*60) && !this.sendingErrorEmail){
        this.sendEmailNotification(path,data);
        this.sendingErrorEmail = true;
      }
    }

  }
  this.sendEmailNotification = function(path,data){
    let self = this;
    mailgun.messages().send(data,function(error,body){
      if(error){
      	self.log(error)
      }
      self.reduceLogSize(path,()=>{
        self.log(null, "email sent. [smtp message: "+ body.message+"]")
      });

      if(path === 'general_log.txt'){
        self.lastLogEmailTime = new Date();
        self.sendingGenEmail = false;
      }else{
        self.lastErrorEmailTime = new Date();
        self.sendingErrorEmail = false;
      }
    
    })

  }

  this.fileWatchComponent = function fileWatchComponent(callback){
  //chose fs.watchFile() over fs.watch() incase the system is not windows or MacOS... Maybe its a RasberryPi
    if(!this.logFileWatcher){
      this.logFileWatcher = chokidar.watch(['general_log.txt','error_log.txt']);
      this.logFileWatcher.on('change',(path,stats)=>{
        return callback(path, nconf.get('maxLogSizeBytes') < stats.size);  
      })
    }
  }
  this.reduceLogSize = function (path,callback){
    const tempwritestream = fs.createWriteStream('temp_'+path); //create a temp file so we don't mess with the one we are replacing. it's currently being used by readstream.
    const readstream = fs.createReadStream(path);
    readstream.on('readable',()=>{
      let chunk;
      let chunks;
      let lognotice;
      while (null !== (chunk = readstream.read(10))) {
        chunks = chunks + chunk;
        //check to see if the lenght of bytes that we have read so far is near the end of the file. If it is we will write to the temp file.
        if(chunks.length > (nconf.get('maxLogSizeBytes') - 400) && !lognotice){
          //put a line at the top of the file to show it was reduced
          lognotice = 'The log was reduced in size and restarted a new one at this point. \r\n'
          //convert the sring to a buffer
          let stringBuff = Buffer.from(lognotice);
          //write to the temp file. 
          tempwritestream.write(stringBuff);
          tempwritestream.write(chunk);
        }else if(chunks.length > (nconf.get('maxLogSizeBytes') - 400 ) && chunk.length >= 10){ //we've already indicated the truncated location now write the remaining data from the old file.
          tempwritestream.write(chunk)
        }else if(chunk.length < 10){ // this is here because at the end of the stream you'll end up with less than 10 bytes of data and so we want to write remaining data to the stream.
          tempwritestream.write(chunk)
          tempwritestream.end();
        }
      }
      //close the write stream so we can read from it.
    })
  //listen for when we're done with the file that we want to replace, this will fire when the readable event has no more data.
    readstream.on('close',()=>{
      const writestream = fs.createWriteStream(path);
      const tempreadstream = fs.createReadStream('temp_'+path);
      tempreadstream.pipe(writestream);
      writestream.on('close',()=>{
        //delete the temporary file
        fs.unlink('temp_'+path, ()=>{
          return callback
        }) 
       
      });
    })
  } 
}






