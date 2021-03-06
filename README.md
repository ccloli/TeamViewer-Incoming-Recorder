# TeamViewer Incoming Recorder

A Node.js script that helps you to record incoming TeamViewer session.

TeamViewer can record outcoming connection, and allows to record automaticly. However TeamViewer doesn't provide an option to record incoming connection from hosted workstation. If the computer enables unattended access, you can get only a little information from log file of TeamViewer, but don't know what the incoming user did on the computer.

The script helps you to check if there is a incoming connection, and record the screen automaticly so that you can check what did he do.

## Required Environment

- Node.js 4.8.0+
- FFmpeg Executable Binary
- Also TeamViewer

Note: Enable logging from TeamViewer is requied, please make sure you have enabled logging and logging incoming connections. Check it out at _TeamViewer Options -> Advanced -> Log files_.
![](https://cloud.githubusercontent.com/assets/8115912/23586733/7b7d74f4-01d6-11e7-9bd4-65cdd18be2e2.png)

## Supports

Should support Windows, Linux and OS X, but I only tested it on Windows, for I can't run the Linux and OS X binaries by some dependence errors. If you have any bugs, please open an issue.

## How It Works

The script will watch the TeamViewer log directory. If the log file was modified, the script will read the modified parts and check if it contains the keywords about start or finished incoming connection. If yes, it will execute FFmpeg to start recording, and stop recording when connection finished.

## How To

```sh
$ node monitor.js [--options]
```

## Options

All the options should have a prefix of `--` and use `=` to split option name and its value like `--foo=bar`.

For the value that contains whitespace, you can use quotes `"..."` or `'...'` to set them.

If you need to use some variables from environment variables, like getting system username, you can use backticks `` `...` `` like template literals and `${}` as the variable that in `process.env`, the system's environment variables. For example, to set `--logFilePath` for TeamViewer 11 on Linux, you can use `` --logFilePath=`/var/log/teamviewer11/${USER}/TeamViewer11_Logfile.log` ``, and `${USER}` will be replaced as `process.env.USER`, the variable `USER` in system's environment variables.

### `--config`

Default: `null`

The specific configuration file. The priority of the file is higher than default config but lower than the options that passed from command line.

Note: All the commands that in the file **don't** need to add `--` prefix, and the latter options will overwrite the previous same options.

Example:
```
logFilePath="C:/Program Files/TeamViewer/TeamViewer11_Logfile.log"
FFmpegPath=D:/foo/bar/ffmpeg.exe
outputDir=D:/bar/foo/
```

### `--logFilePath`

Default: 
- Windows: `C:/Program Files (x86)/TeamViewer/TeamViewer12_Logfile.log`  
- Linux: `/var/log/teamviewer12/${process.env.USER}/TeamViewer12_Logfile.log`
- OS X: `~/Library/Logs/TeamViewer/TeamViewer12_Logfile.log`

The location of log file of TeamViewer. 

For Windows it mostly at where you install TeamViewer, Linux at `/var/log/teamviewer12/[System Username]/`, and OS X at `~/Library/Logs/TeamViewer/`. If you find it incorrect, please correct it with this option, and you can also consider open an issue.

The default file name is for TeamViewer 12, if you are using another version, don't forget to change it.

### `--incomingFilePath`

Default: 
- Windows: `C:/Program Files (x86)/TeamViewer/Connections_incoming.txt`  
- Linux: `/var/log/teamviewer12/Connections_incoming.txt`
- OS X: `~/Library/Logs/TeamViewer/Connections_incoming.txt`

The location of log file of incoming connections from TeamViewer.

For Windows it mostly at where you install TeamViewer, Linux at `/var/log/teamviewer12/`, and OS X at `~/Library/Logs/TeamViewer/`. If you find it incorrect, please correct it with this option, and you can also consider open an issue.

### `--FFmpegPath`

Default: `ffmpeg`

The path to FFmpeg executable binary.

Note: The path should point to the specific FFmpeg binary, not the directory. If FFmpeg is in the same folder with `monitor.js`, define it as `./ffmpeg` if you are in Linux or OS X.

### `--outputDir`

Default: `./`

The directory to save the recorded videos.

Note: Please make sure the value is end with `/`.

### `--outputFileName`

Default: `${ct}-${dt}-${id}${name}.mp4`

The file name of the videos.

`${ct}` means the connected time, `${dt}` means the disconnected time, `${id}` means the incoming TeamViewer ID and `${name}` means the incoming TeamViewer username if available.

You can define the format of time with `--dateFormat`, which is `YmdHis` by default.

Note: When recording video, the temp file name of video is `tmp_${ct}.mp4`.

Example of output by default: `20170227110111-20170227110207-123456789(ccloli).mp4`

### `--fps`

Default: `5`

The framerate (fps) of output videos.

A higher fps will get a smoother video, but the bitrate for each frame will be smaller. For monitoring, less than `10` fps is enough.

### `--bitrate`

Default: `2000000`

The bitrate (bps) of output videos.

Choose a higher bitrate will get better video quality, and a lower bitrate will get smaller video but would drop frames.

Not only the number, but you can also try `500k`, `2m` and `ntsc` for easy understanding which is supported by FFmpeg.

Note: Higher bitrate will makes the video file too large, the file size should be `[bitrate] / 8` bytes/secod, or say `[bitrate] / 1000 / 1000 / 8` MB/s. For recording monitor, less than _2Mbps_ is okay. From my test, video with _500Kbps_, _1080P_ and _`ultrafast`_ can be seen clearly and can be used in most situation. Anyway, TIY and get the best configuration.

### `--videoDeviceIndex`

Default:
- Windows: **Not available**, use `--offsetX`, `--offsetY` and `--videoSize` to crop the screen area.
- Linux: `0.0`
- OS X: `default`

The video device (monitor) index of your device list. 

By default, it will record all your monitors on Windows, the first monitor on Linux and the main monitor on OS X. 

For Linux the format of value is `[hostname]:display_number.screen_number[+x_offset,y_offset]`.
> `hostname:display_number.screen_number` specifies the X11 display name of the screen to grab from. `hostname` can be omitted, and defaults to "localhost". The environment variable `DISPLAY` contains the default display name.
> 
>`x_offset` and `y_offset` specify the offsets of the grabbed area with respect to the top-left border of the X11 screen. They default to `0`.

For OS X the format of value is the device index or the name of device. To get the list of devices, run `ffmpeg -f avfoundation -list_devices true -i ""`.

Note: However if you are on Windows, you **can't** use this options, but you can use offset to crop the area of which screen you want. 

### `--offsetX`

Default: `null`

Defines the X start position of cropped area.

Note: **Not available** on OS X.

### `--offsetY`

Default: `null`

Defines the Y start position of cropped area.

Note: **Not available** on OS X.

### `--videoSize`

Default: `null`

Defines the cropped size of cropped area (video frame size).

The format value should be `[x]x[y]` likes `1024x768`, `1920x1080` or the name of standard size likes `vga`, `hd720`.

Note: it would probably occur an error if the video size exceed the screen available size.

### `--preset`

Default: `ultrafast`

Defines the preset of x264.

Available values are `ultrafast`, `superfast`, `veryfast`, `faster`, `fast`, `medium`, `slow`, `slower`, `veryslow`, which controls the encoding speed. 

Note: A slower speed will get better video quality at the same bitrate, but will also cost more CPU and RAM resource or even drop frames. Change it only if you have a good reason.

### `--scale`

Default: `null`

The frame size of output video.

By default the output video size it's the same as `--videoSize` (raw). The format value should be `[x]x[y]` likes `1024x768`, `1920x1080` or the name of standard size likes `ntsc`, `vga`, `hd720`.

### `--FFmpegExtraArg`

Default: `null` (empty string)

Extra options that will be passed to FFmpeg if you want.

You can also use this option to overwrite default FFmpeg options. The default FFmpeg options can be seen in _[Default FFmpeg Command](#default-ffmpeg-command)_ section.

Note: If you defines the `-vf` options, the `--scale` option will be overwrited. If you also need to scale the video, use `-vf scale=[scale-size],[your -vf options]`

### `--dateFormat`

Default: `YmdHis`

The format of date that will be used in output file name.

Available options are: 
- `Y`: Full year, 4 digits (e.g. `2017`)
- `y`: Short year, 2 digits (e.g. `17`)
- `m`: Month, 2 digits (e.g. `03`)
- `n`: Month, 1 or 2 digits (e.g. `3`)
- `d`: Date, 2 digits (e.g. `04`)
- `H`: Hours, 2 digits (e.g. `08`)
- `G`: Hours, 1 or 2 digits (e.g. `8`)
- `i`: Minutes, 2 digits (e.g. `05`)
- `s`: Seconds, 2 digits (e.g. `01`)
- `I`: Milliseconds, 3 digits (e.g. `015`)
- `U`: Unix timestamp (e.g. `1488618415`)

Note: The time value depends on the timezone from local machine.

### `--debugLevel`

Default: `1`

The details that will output on console.

The level can be chosed between `0` to `3`. `0` is no output, `1` is minimum detail and `3` is maximun detail.

## Default FFmpeg Command

As mentioned, the script needs FFmpeg to record screen. For different system, it'll use different FFmpeg devices to get video devices. Windows uses `gdigrab`, Linux uses `x11grab` and OS X uses `avfoundation`. For more information, see the documentation of [FFmpeg-device](https://ffmpeg.org/ffmpeg-devices.html).

So here is the FFmpeg command that will be executed when recording video. You can use `--FFmpegExtraArg` to overwrite them, as FFmpeg allows same option with multiple values but only the last one will be used.

- Windows:
	```sh
	"${FFmpegPath}" -f gdigrab -framerate ${fps} \  
	    -offset_x ${offsetX} -offset_y ${offsetY} -video_size ${videoSize} \  
	    -i desktop -vcodec libx264 -b:v ${bitrate} -vf scale=${scale} \  
	    -preset ${preset} ${FFmpegExtraArg} "${outputDir}tmp_[${dateFormat}].mp4"
	```
- Linux:
	```sh
	"${FFmpegPath}" -f x11grab -framerate ${fps} \  
	    -grab_x ${offsetX} -grab_y ${offsetY} -video_size ${videoSize} \  
	    -i ${videoDeviceIndex} -vcodec libx264 -b:v ${bitrate} -vf scale=${scale} \  
	    -preset ${preset} ${FFmpegExtraArg} "${outputDir}tmp_[${dateFormat}].mp4"
	```
- OS X:
	```sh
	"${FFmpegPath}" -f avfoundation -framerate ${fps} \  
	    -video_size ${videoSize} -i "${videoDeviceIndex}:none" -capture_cursor 1 \  
	    -capture_mouse_clicks 1 -vcodec libx264 -b:v ${bitrate} -vf scale=${scale} \  
	    -preset ${preset} ${FFmpegExtraArg} "${outputDir}tmp_[${dateFormat}].mp4"
	```

## License

Licensed under the [MIT License](LICENSE).