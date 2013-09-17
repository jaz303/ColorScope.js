;(function() {

  var URL    = /url\(['"]?([^'"]+)['"]?\)/;
  var HEX_6  = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/ig;
  var HEX_3  = /#([0-9a-f]{1})([0-9a-f]{1})([0-9a-f]{1})/ig;
  var RGB    = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
  var RGBA   = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+),\s*(\d+)\s*\)/g;

  var COLOR_CSS = [
    'color',
    'backgroundColor',
    'borderLeftColor',
    'borderRightColor',
    'borderTopColor',
    'borderBottomColor'
  ];

  var IMAGE_CSS = [
    'backgroundImage'
  ];

  var IMAGE_ATTRS = [
    'src',
    'background'
  ];

  var IGNORE = [
    'object',
    'embed',
    'param',
    'video',
    'audio',
    'script',
    'iframe'
  ];

  if (typeof Array.prototype.forEach === 'function') {
    function forEach(collection, callback) {
      collection.forEach(callback);
    }
  } else {
    function forEach(collection, callback) {
      for (var i = 0, l = collection.length; i < l; ++i) {
        callback(collection[i]);
      }
    }
  }

  function getStyle(el, styleProp) {
    if (el.currentStyle) {
      return el.currentStyle[styleProp];
    } else if (window.getComputedStyle) {
      return window.getComputedStyle(el, null)[styleProp];
    } else {
      throw "can't compute style";
    }
  };

  function findAllElements() {
    var sourceElements  = document.getElementsByTagName('*'),
        allElements     = [];
    for (var i = 0; i < sourceElements.length; ++i) {
      var e = sourceElements[i];
      if (IGNORE.indexOf(e.nodeName.toLowerCase()) < 0) {
        allElements.push(e);
      }
    }
    return allElements;
  }

  function indexDocument() {
    var index = [];

    forEach(findAllElements(), function(ele) {
      var attribs = {style: {}};

      forEach(COLOR_CSS, function(key) {
        var s = getStyle(ele, key);
        if (s) attribs.style[key] = s;
      });

      forEach(IMAGE_CSS, function(key) {
        var s = getStyle(ele, key);
        if (s) attribs.style[key] = s;
      });

      forEach(IMAGE_ATTRS, function(key) {
        if (ele.hasAttribute(key)) {
          attribs[key] = ele.getAttribute(key);
        }
      });

      index.push({
        element         : ele,
        attributeCache  : attribs
      });
    });

    return index;
  }

  function filter(r, g, b, callback) {
    var color = callback([r, g, b]);
    color[0] = Math.floor(color[0]);
    color[1] = Math.floor(color[1]);
    color[2] = Math.floor(color[2]);
    return color;
  };

  function convertImageToDataURL(imageURL, algorithm, onComplete) {
    var image = new Image();
    image.onload = function() {
      var div = document.createElement('div');
      div.innerHTML = "<canvas width='" + this.width + "' height='" + this.height + "' />";
      var canvas = div.childNodes[0], ctx = canvas.getContext('2d');
      ctx.drawImage(this, 0, 0);
      try {
        var pixels = ctx.getImageData(0, 0, this.width, this.height),
            length = pixels.data.length,
            data   = pixels.data;
        for (var i = 0; i < length; i += 4) {
          var t       = filter(data[i], data[i + 1], data[i + 2], algorithm);
          data[i]     = t[0];
          data[i + 1] = t[1];
          data[i + 2] = t[2];
        }
        ctx.putImageData(pixels, 0, 0);
        onComplete(canvas.toDataURL('image/png'));
      } catch (e) {
        console.log(e, e.message);
        onComplete(null);
      }
    };
    image.src = imageURL;
  };

  function tr(color, callback) {

    if (typeof color !== 'string')
      return color;

    var out = color.replace(HEX_6, function(m) {
      var c = filter(parseInt(RegExp.$1, 16),
                     parseInt(RegExp.$2, 16),
                     parseInt(RegExp.$3, 16), callback);
      return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    }).replace(HEX_3, function(m) {
      var c = filter(parseInt('' + RegExp.$1 + RegExp.$1, 16),
                     parseInt('' + RegExp.$2 + RegExp.$2, 16),
                     parseInt('' + RegExp.$3 + RegExp.$3, 16), callback);
      return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    }).replace(RGB, function(m) {
      var c = filter(parseInt(RegExp.$1, 10),
                     parseInt(RegExp.$2, 10),
                     parseInt(RegExp.$3, 10), callback);
      return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    }).replace(RGBA, function(m) {
      var c = filter(parseInt(RegExp.$1, 10),
                     parseInt(RegExp.$2, 10),
                     parseInt(RegExp.$3, 10), callback);
      return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + RegExp.$4 + ')';
    });

    return out;

  };

  function recolorWithAlgorithm(index, alg) {

    forEach(index, function(entry) {
      var ele = entry.element, attribs = entry.attributeCache;
      forEach(COLOR_CSS, function(key) {
        if (key in attribs.style) {
          ele.style[key] = tr(attribs.style[key], alg);
        }
      });
    });

    var queue = [];

    forEach(index, function(entry) {
      var ele = entry.element, attribs = entry.attributeCache;
      forEach(IMAGE_ATTRS, function(key) {
        if (key in attribs)
          queue.push([ele, 'attr', key, attribs[key]]);
      });
      forEach(IMAGE_CSS, function(key) {
        if (key in attribs.style)
          queue.push([ele, 'css', key, attribs.style[key]]);
      });
    });

    (function pop() {
      if (!queue.length)
        return;

      var item  = queue.shift(),
          ele   = item[0],
          type  = item[1],
          attr  = item[2],
          orig  = item[3];

      if (type === 'attr') {
        convertImageToDataURL(orig, alg, function(data) {
          if (data)
            ele.setAttribute(attr, data);
          setTimeout(pop, 0);
        });
      } else {
        if (orig.match(URL)) {
          convertImageToDataURL(RegExp.$1, alg, function(data) {
            if (data)
              ele.style[attr] = 'url("' + data + '")';
            setTimeout(pop, 0);
          });
        } else {
          setTimeout(pop, 0);
        }
      }

    })();

  }

  function getAlgorithm(callback) {
    function addButton(ele, alg, bgcolor) {
      var btn = document.createElement('input');
      btn.type = 'button';
      btn.value = alg;
      btn.style.backgroundColor = bgcolor;
      btn.style.color = 'white';
      btn.style.border = 'none';
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.marginBottom = '6px';
      btn.style.borderRadius = '6px';
      btn.style.fontSize = '14px';
      btn.onclick = function() {
        document.body.removeChild(chooser);
        if (alg !== 'Cancel') callback(alg);
      }
      ele.appendChild(btn);
    }

    var chooser = document.createElement('div');
    chooser.style.position = 'fixed';
    chooser.style.borderRadius = '8px';
    chooser.style.top = '20px';
    chooser.style.left = '20px';
    chooser.style.padding = '10px';
    chooser.style.backgroundColor = '#2c3e50';
    chooser.style.boxShadow = '0 0 10px #505050';
    for (var k in fBlind)
      addButton(chooser, k, '#27ae60');
    addButton(chooser, 'Cancel', '#c0392b');
    document.body.appendChild(chooser);
  }

  //
  // Entry Point

  if (!window.__colorScopeIndex__) {
    window.__colorScopeIndex__ = indexDocument();
  }

  function colorScope() {
    getAlgorithm(function(alg) {
      recolorWithAlgorithm(window.__colorScopeIndex__, fBlind[alg]);
    });
  };

  // The Color Blind Simulation function is
  // copyright (c) 2000-2001 by Matthew Wickline and the
  // Human-Computer Interaction Resource Network ( http://hcirn.com/ ).
  //
  // It is used with the permission of Matthew Wickline and HCIRN,
  // and is freely available for non-commercial use. For commercial use, please
  // contact the Human-Computer Interaction Resource Network ( http://hcirn.com/ ).

  var rBlind = {
    'protan': {'cpu':0.735,'cpv':0.265,'am':1.273463,'ayi':-0.073894},
    'deutan': {'cpu':1.14,'cpv':-0.14,'am':0.968437,'ayi':0.003331},
    'tritan': {'cpu':0.171,'cpv':-0.003,'am':0.062921,'ayi':0.292119},
    'custom': {'cpu':0.735,'cpv':0.265,'am':-1.059259,'ayi':1.026914}
  };

  var fBlind = {
    "Normal"        : function(v) { return(v); },
    "Protanopia"    : function(v) { return(blindMK(v,'protan')); },
    "Protanomaly"   : function(v) { return(anomylize(v,blindMK(v,'protan'))); },
    "Deuteranopia"  : function(v) { return(blindMK(v,'deutan')); },
    "Deuteranomaly" : function(v) { return(anomylize(v,blindMK(v,'deutan'))); },
    "Tritanopia"    : function(v) { return(blindMK(v,'tritan')); },
    "Tritanomaly"   : function(v) { return(anomylize(v,blindMK(v,'tritan'))); },
    "Achromatopsia" : function(v) { return(monochrome(v)); },
    "Achromatomaly" : function(v) { return(anomylize(v,monochrome(v))); }
  };

  function blindMK(r,t) {
    var gamma=2.2, wx=0.312713, wy=0.329016, wz=0.358271;
    function Color() { this.rgb_from_xyz=xyz2rgb; this.xyz_from_rgb=rgb2xyz; }
    var b=r[2], g=r[1], r=r[0], c=new Color;
    c.r=Math.pow(r/255,gamma); c.g=Math.pow(g/255,gamma); c.b=Math.pow(b/255,gamma); c.xyz_from_rgb();
    var sum_xyz=c.x+c.y+c.z; c.u=0; c.v=0;
    if(sum_xyz!=0) { c.u=c.x/sum_xyz; c.v=c.y/sum_xyz; }
    var nx=wx*c.y/wy, nz=wz*c.y/wy, clm, s=new Color(), d=new Color(); d.y=0;
    if(c.u<rBlind[t].cpu) { clm=(rBlind[t].cpv-c.v)/(rBlind[t].cpu-c.u); } else { clm=(c.v-rBlind[t].cpv)/(c.u-rBlind[t].cpu); }
    var clyi=c.v-c.u*clm; d.u=(rBlind[t].ayi-clyi)/(clm-rBlind[t].am); d.v=(clm*d.u)+clyi;
    s.x=d.u*c.y/d.v; s.y=c.y; s.z=(1-(d.u+d.v))*c.y/d.v; s.rgb_from_xyz();
    d.x=nx-s.x; d.z=nz-s.z; d.rgb_from_xyz();
    var adjr=d.r?((s.r<0?0:1)-s.r)/d.r:0, adjg=d.g?((s.g<0?0:1)-s.g)/d.g:0, adjb=d.b?((s.b<0?0:1)-s.b)/d.b:0;
    var adjust=Math.max(((adjr>1||adjr<0)?0:adjr), ((adjg>1||adjg<0)?0:adjg), ((adjb>1||adjb<0)?0:adjb));
    s.r=s.r+(adjust*d.r); s.g=s.g+(adjust*d.g); s.b=s.b+(adjust*d.b);
    function z(v) { return(255*(v<=0?0:v>=1?1:Math.pow(v,1/gamma))); }
    return([z(s.r),z(s.g),z(s.b)]);
  };

  function rgb2xyz() {
    this.x=(0.430574*this.r+0.341550*this.g+0.178325*this.b);
    this.y=(0.222015*this.r+0.706655*this.g+0.071330*this.b);
    this.z=(0.020183*this.r+0.129553*this.g+0.939180*this.b);
    return this;
  };

  function xyz2rgb() {
    this.r=( 3.063218*this.x-1.393325*this.y-0.475802*this.z);
    this.g=(-0.969243*this.x+1.875966*this.y+0.041555*this.z);
    this.b=( 0.067871*this.x-0.228834*this.y+1.069251*this.z);
    return this;
  };

  function anomylize(a,b) {
    var v=1.75, d=v*1+1;
    return([(v*b[0]+a[0]*1)/d, (v*b[1]+a[1]*1)/d, (v*b[2]+a[2]*1)/d]);
  };

  function monochrome(r) {
    var z=Math.round(r[0]*.299+r[1]*.587+r[2]*.114);
    return([z,z,z]);
  };

  colorScope();

})()
