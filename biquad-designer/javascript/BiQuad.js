/***************************************************************************
 *   Copyright (C) 2017, Paul Lutus                                        *
 *                                                                         *
 *   This program is free software; you can redistribute it and/or modify  *
 *   it under the terms of the GNU General Public License as published by  *
 *   the Free Software Foundation; either version 2 of the License, or     *
 *   (at your option) any later version.                                   *
 *                                                                         *
 *   This program is distributed in the hope that it will be useful,       *
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of        *
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the         *
 *   GNU General Public License for more details.                          *
 *                                                                         *
 *   You should have received a copy of the GNU General Public License     *
 *   along with this program; if not, write to the                         *
 *   Free Software Foundation, Inc.,                                       *
 *   59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.             *
 ***************************************************************************/

var BiQuad = BiQuad || {}

// function to add an event listener

BiQuad.addListener = function(element, eventName, handler) {
  if (element.addEventListener) {
    element.addEventListener(eventName, handler, false);
  }
  else if (element.attachEvent) {
    element.attachEvent('on' + eventName, handler);
  }
  else {
    element['on' + eventName] = handler;
  }
}

BiQuad.left_margin = 0;
BiQuad.right_margin = 1;
BiQuad.top_margin = 0;
BiQuad.bottom_margin = 1;

BiQuad.old_mouse_x = -1;
BiQuad.old_mouse_y = -1;

BiQuad.xSteps = 10;
BiQuad.ySteps = 5;
BiQuad.samples = 2000;
BiQuad.filter_type = 0;
BiQuad.vertLogScale = true;
BiQuad.horizLogScale = false;

BiQuad.grid_color = "rgb(192,192,192)";
BiQuad.plot_color = "rgb(0,64,255)";
BiQuad.point_color = "rgb(255,0,0)";
BiQuad.explore_color = "rgb(128,0,128)";
BiQuad.cookieName = "BiQuadDesigner";
BiQuad.defaultVals = {'input_cf':10000.0,'input_rate':40000.0,'input_q':0.707,'input_gain':1.0};

BiQuad.writeCookie = function(name,value,days) {
  var expires = "";
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + (days*24*60*60*1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + value + expires + "; path=/";
}

BiQuad.readCookie = function(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') {
      c = c.substring(1,c.length);
    }
    if (c.indexOf(nameEQ) == 0) {
      return c.substring(nameEQ.length,c.length);
    }
  }
  return null;
}

BiQuad.writeControls = function() {
  result = [];
  items = document.getElementsByClassName("cookie");
  for (var i = 0;i < items.length;i++) {
    item = items[i];
    var type = item.type;
    if(type == "radio") {
      result.push(item.checked);
    }
    else if (type == "number") {
      result.push(item.value);
    }
  }
  output = result.join("|");
  BiQuad.writeCookie(BiQuad.cookieName,output,120);
}

BiQuad.readControls = function() {
  var data = BiQuad.readCookie(BiQuad.cookieName);
  //console.log("read cookie: " + data);
  if(data != null && data.length > 16) {
    array = data.split("|");
    items = document.getElementsByClassName("cookie");
    for (var i = 0;i < items.length;i++) {
      var item = items[i];
      var type = item.type;
      val = array[i];
      if(type == "radio") {
        //console.log("item " + name + "," + type + " checked " + item.checked);
        //result.push("" + item.checked);
        item.checked = val == "true";
      }
      else if (type == "number") {
        item.value = val;
        //console.log("item " + name + "," + type + " value " + item.value);
        //result.push(item.value);
      }
    }
    items = document.getElementsByName("filtertype");
    for(var i = 0;i < items.length;i++) {
      item = items[i];
      if(item.checked) {
        BiQuad.filter_type = i;
        break;
      }
    }
  }
}

// interpolate x from xa,xb -> ya,yb

BiQuad.interp = function(x,xa,xb,ya,yb) {
  var q = xb-xa;
  if(q == 0) return 0;
  return (x-xa) * (yb-ya)/q + ya;
}

BiQuad.graphDimClass = function(xl,xh,yl,yh) {
  this.xl = xl;
  this.xh = xh;
  this.yl = yl;
  this.yh = yh;
  this.str = function() {
    return this.xl + "," + this.xh + "," + this.yl + "," + this.yh;
  }
}

BiQuad.wheelHandler = function(event) {
  var delta = 0;
  if(!event) {
    event = window.event;
  }
  if (event.wheelDelta) {
    delta = event.wheelDelta;
  }
  if (window.opera) {
    delta = -delta;
  }
  else if (event.detail) {
    delta = -event.detail;
  }
  if (event.target) {
    target = event.target;
  }
  else if (event.srcElement) {
    target = event.srcElement;
  }
  // defeat Safari bug
  if (target.nodeType == 3) {
    target = target.parentNode;
  }
  delta = (delta > 0)?1:-1;
  var name = target.id;
  if (name && name.match(/input_.*/)) {
    tv = parseFloat(target.value);
    target.value = (tv + delta * Math.abs(tv)/20).toFixed(2);
    //if(event.stopPropagation) {
    //  event.stopPropagation();
    //}
    //if(event.preventDefault) {
    //  event.preventDefault();
    //}
    event.cancelBubble = true;
    event.cancel = true;
    event.returnValue = false;
    BiQuad.prepareChart();
    return false;
  }
  else {
    return true;
  }
}

BiQuad.set_dimensions = function() {
  var bottom = BiQuad.amplitude.canvas.height - BiQuad.bottom_margin;
  var left = BiQuad.left_margin;
  var right = BiQuad.amplitude.canvas.width - BiQuad.right_margin;
  var top = BiQuad.top_margin;
  BiQuad.graph_dims = new BiQuad.graphDimClass(parseInt(left),parseInt(right),parseInt(top),parseInt(bottom));
}

BiQuad.draw_line = function(canvas_ctx, x1,y1,x2,y2) {
  try {
    canvas_ctx.moveTo(x1,y1);
    canvas_ctx.lineTo(x2,y2);
  }
  catch(err) {
    error_flag = true;
  }
}

BiQuad.removeChildren = function(item) {
  while (item.firstChild) {
    item.firstChild.remove();
  }
}

BiQuad.convertLogScale = function(x,a,b,isLog) {
  if(isLog) {
    x = BiQuad.interp(x,a,b,0,1);
    x = (Math.pow(x+1,10))/1024;
    x = BiQuad.interp(x,0,1,a,b);
  }
  return x;
}

BiQuad.plot_grid = function(element, miny, maxy) {
  var e = BiQuad[element];

  BiQuad.removeChildren(e.bottomIndex);
  BiQuad.removeChildren(e.leftIndex);
  e.canvas_ctx.beginPath();
  var px,py;
  var ox = null;
  var oy = null;
  e.canvas_ctx.strokeStyle = BiQuad.grid_color;
  for (var x = 0;x <= BiQuad.xSteps; x++) {
    px = BiQuad.interp(x,0,BiQuad.xSteps,BiQuad.graph_dims.xl,BiQuad.graph_dims.xh);
    px = parseInt(px);
    BiQuad.draw_line(e.canvas_ctx, px,BiQuad.graph_dims.yl,px,BiQuad.graph_dims.yh);
    var ix = BiQuad.convertLogScale(x,0,BiQuad.xSteps,BiQuad.horizLogScale);
    var xindex = BiQuadFilter.sample_rate * .5 * ix/ BiQuad.xSteps;
    var s = xindex.toFixed(1);
    var div = document.createElement('div');
    var pct = 100.0/(BiQuad.xSteps+1);
    div.style.width = pct.toFixed(2) + "%";
    div.style.display = 'inline-block';
    div.className += "indexDisplay";
    div.innerHTML = s;
    e.bottomIndex.appendChild(div);
  }
  for (var y = 0;y <= BiQuad.ySteps; y++) {
    py = BiQuad.interp(y,BiQuad.ySteps,0,BiQuad.graph_dims.yl,BiQuad.graph_dims.yh);
    py = parseInt(py);
    BiQuad.draw_line(e.canvas_ctx, BiQuad.graph_dims.xl,py,BiQuad.graph_dims.xh,py);
    var yindex = BiQuad.interp(y,0,BiQuad.ySteps,maxy,miny);
    var s = yindex.toFixed(1);
    var div = document.createElement('div');
    var pct = 100.0/BiQuad.ySteps;
    div.style.height = pct.toFixed(2) + "%";
    div.className += "indexDisplay";
    div.innerHTML = s;
    e.leftIndex.appendChild(div);
  }
  e.canvas_ctx.stroke();
  e.canvas_ctx.closePath();
}

BiQuad.getFilterType = function(item) {
  //console.log(item.value);
  BiQuad.setChartType(parseInt(item.value));
}

BiQuad.setChartType = function(type) {
  BiQuad.filter_type = type;
  BiQuad.prepareChart();
}

BiQuad.prepareChart = function() {
  BiQuad.vertLogScale = !document.querySelector("#vert_linear").checked;
  BiQuad.horizLogScale = document.querySelector("#horiz_log").checked;
  var inputs = document.getElementsByClassName("filterValue");
  var array = [];
  for(var i = 0; i < inputs.length;i++) {
    array[i] = parseFloat(inputs[i].value);
    //console.log(array[i]);
  }
  BiQuad.center_freq = array[0];
  var rate = array[1];
  var Q = array[2];
  var gain = array[3];
  if(BiQuad.center_freq > rate / 2) {
    BiQuad.center_freq = rate / 2;
    document.querySelector("#input_cf").value = BiQuad.center_freq;
  }
  BiQuadFilter.create(BiQuad.filter_type,BiQuad.center_freq,rate,Q,gain);
  s = "<p><b>Filter Constants:</b></p>";
  for(var i = 1; i < 6;i++) {
    var v = BiQuadFilter.constants()[i-1]; // contains [a1,a2,b0,b1,b2]
    v = BiQuad.formatNumber(v,8);
    n = i % 3;
    lbl = (i < 3)?"a":"b";
    s += lbl + "<sub>" + n + "</sub> = " + v + "<br/>";
  }
  document.querySelector("#constants").innerHTML = s;
  BiQuad.amplitude.draw();
  BiQuad.phase.draw();
}

BiQuad.formatNumber = function(n,p) {
  if(Math.abs(n) < 1e-3) {
    return n.toExponential(p);
  }
  else {
    return n.toFixed(p);
  }
}

BiQuad.getAmplitude = function(x) {
  if(BiQuad.vertLogScale) {
    return BiQuadFilter.log_amplitude(x);
  }
  else {
    return BiQuadFilter.amplitude(x);
  }
}

BiQuad.drawAmplitude = function(e) {
  var element = 'amplitude'

  // get vertical scale limits and create y data array
  var ydata = [];
  BiQuad[element].miny = 1e9;
  BiQuad[element].maxy = -1e9;
  for(var i = 0;i < BiQuad.samples;i++) {
    var ix = BiQuad.convertLogScale(i,0,BiQuad.samples,BiQuad.horizLogScale);
    var f = BiQuad.interp(ix,0,BiQuad.samples,0,BiQuadFilter.sample_rate / 2);
    var amplitude = BiQuad.amplitude.get(f);
    ydata.push(amplitude);
    BiQuad[element].miny = Math.min(amplitude, BiQuad[element].miny);
    BiQuad[element].maxy = Math.max(amplitude, BiQuad[element].maxy); 
  }

  // must acquire this exact point also
  // for maxy, miny only
  var center_amplitude = BiQuad.amplitude.get(BiQuadFilter.center_freq);
  BiQuad[element].miny = Math.min(center_amplitude, BiQuad[element].miny);
  BiQuad[element].maxy = Math.max(center_amplitude, BiQuad[element].maxy); 
  
  if(BiQuad.vertLogScale && BiQuad[element].miny < -40) {
    BiQuad[element].miny = -100;
  }
  
  BiQuad.amplitude.canvas_ctx.clearRect(0, 0, BiQuad.amplitude.canvas.width, BiQuad.amplitude.canvas.height);
  BiQuad.plot_grid(element, BiQuad[element].miny, BiQuad[element].maxy);
  BiQuad.amplitude.canvas_ctx.strokeStyle = BiQuad.plot_color;
  BiQuad.amplitude.canvas_ctx.beginPath();
  for(var i = 0;i < BiQuad.samples;i++) {
    //var x = BiQuad.interp(i,0,BiQuad.samples,0,BiQuadFilter.frequency() * 2);
    var px = BiQuad.interp(i,0,BiQuad.samples,BiQuad.graph_dims.xl,BiQuad.graph_dims.xh);
    var y = ydata[i];
    var py = BiQuad.interp(y,BiQuad[element].miny,BiQuad[element].maxy,BiQuad.graph_dims.yh,BiQuad.graph_dims.yl);
    px = parseInt(px+0.5);
    py = parseInt(py+0.5);
    if(i == 0) {
      BiQuad.amplitude.canvas_ctx.moveTo(px,py);
    }
    else {
      BiQuad.amplitude.canvas_ctx.lineTo(px,py);
    }
  }
  BiQuad.amplitude.canvas_ctx.stroke();
  BiQuad.amplitude.canvas_ctx.closePath();
}

BiQuad.getPhase = BiQuadFilter.phase;

BiQuad.drawPhase = function() {
  var element = 'phase';

  // get vertical scale limits and create y data array
  var ydata = [];
  BiQuad[element].miny = 1e9;
  BiQuad[element].maxy = -1e9;
  var prevPhase;
  var add = 0;
  var gotCenterFreq = false;

  for(var i = 0; i < BiQuad.samples; i++) {
    var ix = BiQuad.convertLogScale(i, 0, BiQuad.samples, BiQuad.horizLogScale);
    var f = BiQuad.interp(ix, 0, BiQuad.samples, 0, BiQuadFilter.sample_rate / 2);
    var phase = BiQuad.getPhase(f) + add;

    // deal with rollover
    if (Math.abs(phase - prevPhase) > Math.PI / 2) {
      add -= Math.PI;
      phase -= Math.PI;
    }
    prevPhase = phase;

    ydata.push(phase);
    BiQuad[element].miny = Math.min(phase, BiQuad[element].miny);
    BiQuad[element].maxy = Math.max(phase, BiQuad[element].maxy);

    // must acquire this exact point also
    // for maxy, miny only
    if (!gotCenterFreq && Math.abs(f - BiQuadFilter.center_freq) * BiQuadFilter.sample_rate < 2) {
      var centerPhase = BiQuad.getPhase(BiQuadFilter.center_freq) + add;
      BiQuad[element].miny = Math.min(centerPhase, BiQuad[element].miny);
      BiQuad[element].maxy = Math.max(centerPhase, BiQuad[element].maxy);

      gotCenterFreq = true;
    }
  }

  BiQuad.phase.canvas_ctx.clearRect(0, 0, BiQuad.phase.canvas.width, BiQuad.phase.canvas.height);
  BiQuad.plot_grid(element, BiQuad[element].miny, BiQuad[element].maxy);
  BiQuad.phase.canvas_ctx.strokeStyle = BiQuad.plot_color;
  BiQuad.phase.canvas_ctx.beginPath();
  for(var i = 0;i < BiQuad.samples;i++) {
    //var x = BiQuad.interp(i,0,BiQuad.samples,0,BiQuadFilter.frequency() * 2);
    var px = BiQuad.interp(i,0,BiQuad.samples,BiQuad.graph_dims.xl,BiQuad.graph_dims.xh);
    var y = ydata[i];
    var py = BiQuad.interp(y,BiQuad[element].miny,BiQuad[element].maxy,BiQuad.graph_dims.yh,BiQuad.graph_dims.yl);
    px = parseInt(px+0.5);
    py = parseInt(py+0.5);
    if(i == 0) {
      BiQuad.phase.canvas_ctx.moveTo(px,py);
    }
    else {
      BiQuad.phase.canvas_ctx.lineTo(px,py);
    }
  }
  BiQuad.phase.canvas_ctx.stroke();
  BiQuad.phase.canvas_ctx.closePath();
}

BiQuad.eraseMouseDiv = function(evt) {
  if(BiQuad.mouseDiv) {
    BiQuad.body.removeChild(BiQuad.mouseDiv);
    BiQuad.mouseDiv = null;
  }
}

BiQuad.manageMouse = function(element, evt) {
  var rect = BiQuad[element].canvas.getBoundingClientRect();

  var px = evt.clientX;
  var ix = BiQuad.convertLogScale(px,rect.left,rect.right,BiQuad.horizLogScale);
  var f = BiQuad.interp(ix,rect.left,rect.right,0,BiQuadFilter.sample_rate / 2)
  var y = BiQuad[element].get(f);
  var py = BiQuad.interp(y,BiQuad[element].miny,BiQuad[element].maxy,BiQuad.graph_dims.yh,BiQuad.graph_dims.yl);
  py +=  BiQuad[element].canvas.offsetTop - 6;
  px -= 4;
  BiQuad.eraseMouseDiv();
  BiQuad.mouseDiv = document.createElement('div');
  y = BiQuad[element].getRaw(f);

  BiQuad.mouseDiv.style = "font-family:monospace;font-size:80%;background:rgba(255,255,255,.85);user-select:none;pointer-events:none;text-align:left;position:absolute;top:" + py + "px;left:" + px + "px;";

  var s = "+ f = " + f.toFixed(3) + " Hz<br/>&nbsp; y = " + y.toFixed(3) + "<br/>&nbsp;&nbsp;&nbsp;&nbsp;= ";
  if (element === 'amplitude') {
    var logy = Math.log10(y) * 20;
    s += logy.toFixed(3) + " dB";
  } else {
    s += y * 180 / Math.PI + " º";
  }

  BiQuad.mouseDiv.innerHTML = s;
  BiQuad.body.appendChild(BiQuad.mouseDiv);
}

BiQuad.start = function() {
  if (window.addEventListener) {
    window.addEventListener('DOMMouseScroll', BiQuad.wheelHandler, false);
  }
  BiQuad.addListener(document,'mousewheel',BiQuad.wheelHandler);
  //document.onmousewheel = BiQuad.wheelHandler;
  BiQuad.defaults(true);
  BiQuad.readControls();
  inputs = document.getElementsByClassName("filterValue");
  for(var i = 0;i < inputs.length;i++) {
    input = inputs[i];
    input.title = "Use your mouse wheel to change this value";
  }

  BiQuad.body = document.getElementsByTagName("body")[0];

  BiQuad.amplitude = {
    canvas: document.querySelector("#amplitudeCanvas"),
    leftIndex: document.querySelector("#amplitudeLeftColumn"),
    bottomIndex: document.querySelector("#amplitudeBottomRow"),

    canvas_ctx: (() => {
      var context = document.querySelector('#amplitudeCanvas').getContext('2d');
      context.translate(0.5, 0.5);
      return context;
    })(),
    getRaw: BiQuadFilter.amplitude,
    get: BiQuad.getAmplitude,
    acquire: BiQuad.acquireAmplitude,
    draw: BiQuad.drawAmplitude
  };

  BiQuad.addListener(BiQuad.amplitude.canvas, 'mousemove', BiQuad.manageMouse.bind(this, 'amplitude'));
  BiQuad.addListener(BiQuad.amplitude.canvas, 'mouseout', BiQuad.eraseMouseDiv);

  BiQuad.phase = {
    canvas: document.querySelector("#phaseCanvas"),
    leftIndex: document.querySelector("#phaseLeftColumn"),
    bottomIndex: document.querySelector("#phaseBottomRow"),

    canvas_ctx: (() => {
      var context = document.querySelector('#phaseCanvas').getContext('2d');
      context.translate(0.5, 0.5);
      return context;
    })(),
    getRaw: BiQuadFilter.phase,
    get: BiQuad.getPhase,
    acquire: BiQuad.acquirePhase,
    draw: BiQuad.drawPhase
  };

  BiQuad.addListener(BiQuad.phase.canvas, 'mousemove', BiQuad.manageMouse.bind(this, 'phase'));
  BiQuad.addListener(BiQuad.phase.canvas, 'mouseout', BiQuad.eraseMouseDiv);

  var radioButtons = document.getElementsByClassName("ftRadio");
  for(var i = 0;i < radioButtons.length;i++) {
    var item = radioButtons[i];
    item.value = i;
    BiQuad.addListener(item,"click", function() {
        BiQuad.getFilterType(this);
    });
  }
  var vsMode = document.getElementsByClassName("vsRadio");
  for(var i = 0; i < vsMode.length; i++) {
    var item = vsMode[i];
    item.value = i;
    BiQuad.addListener(item,"click", function() {
        BiQuad.prepareChart();
    });
  }
  var filterEntries = document.getElementsByClassName("filterValue");
  for(var i = 0;i < filterEntries.length;i++) {
    var item = filterEntries[i];
    BiQuad.addListener(item,"change", function() {
        BiQuad.prepareChart();
    });
  }
  BiQuad.set_dimensions();
  BiQuad.prepareChart();
}

BiQuad.setDefaultRedraw = function(name) {
  BiQuad.setDefaultValue(name);
  BiQuad.prepareChart();
}

BiQuad.setDefaultValue = function(name) {
  document.querySelector("#" + name).value = BiQuad.defaultVals[name];
}

BiQuad.defaults = function(force) {
  if(force || window.confirm("Okay to set default values?")) {
    var keys = Object.keys(BiQuad.defaultVals);
    for(var i = 0;i < keys.length;i++) {
      key = keys[i];
      BiQuad.setDefaultValue(key);
    }
    document.querySelector("#vert_log").checked = true;
    document.querySelector("#horiz_linear").checked = true;
    var item = document.querySelector("#lowpass_filter");
    item.checked = true;
    if(!force) {
      BiQuad.getFilterType(item);
    }
  }
}

BiQuad.addListener(window,'load',BiQuad.start);

BiQuad.addListener(window,'unload',BiQuad.writeControls);
