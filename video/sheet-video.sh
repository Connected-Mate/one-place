#!/bin/bash
# Contact sheet of a rendered film, one frame every N seconds: sheet-video.sh film.mp4 out.jpg [every=2] [cols=6] [from] [to]
F="$(cd "$(dirname "$0")" && pwd)/node_modules/ffmpeg-static/ffmpeg"
IN=$1; OUT=$2; EV=${3:-2}; COLS=${4:-6}; FROM=${5:-0}; TO=${6:-61}
N=$(python3 -c "import math;print(math.ceil(($TO-$FROM)/$EV))"); R=$(( (N+COLS-1)/COLS ))
"$F" -hide_banner -loglevel error -y -ss $FROM -to $TO -i "$IN" -vf "fps=1/$EV,scale=${SC:-480}:-1,drawtext=text='%{pts\:hms}':x=8:y=8:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.5,pad=iw+4:ih+4:2:2:gray,tile=${COLS}x${R}:color=gray" -frames:v 1 -update 1 "$OUT" 2>/dev/null || "$F" -hide_banner -loglevel error -y -ss $FROM -to $TO -i "$IN" -vf "fps=1/$EV,scale=${SC:-480}:-1,pad=iw+4:ih+4:2:2:gray,tile=${COLS}x${R}:color=gray" -frames:v 1 -update 1 "$OUT"
