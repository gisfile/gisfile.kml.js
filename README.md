# gisfile.kml.js
L.GisFileKml turns kml box data into a Leaflet layer

<p>
This is the Gisfile Javascript API, version 1.x. It's built as a <a href="http://leafletjs.com/">Leaflet</a>
plugin. You can <a href="http://gisfile.com/api/1.0/doc/box/">read more about the Gisfile API</a>
</p>

<h2>
<a id="user-content-exampls" class="anchor" href="#exampls" aria-hidden="true">
Examples
</h2>

<ul>
<li><a href="http://gisfile.com/layer/USACountry/tile?kml&lat=39&lon=-98&z=5&fs=1">kml box data</a></li>
<li><a href="http://gisfile.com/layer/USARegions/tile?kmz&lat=39&lon=-98&z=5&fs=1">kmz box data</a></li>
</ul>

<h2>
<a id="user-content-api" class="anchor" href="#api" aria-hidden="true">
<span class="octicon octicon-link"></span></a>
<a href="http://gisfile.com/js/gisfile.kml.js">API</a>
</h2>

<p>Latest version of the GISfile JavaScript API in the <code>src</code> directory</p>

<h2>
<a id="user-content-examples" class="anchor" href="#examples" aria-hidden="true">
<span class="octicon octicon-link"></span></a>
<a href="http://gisfile.com/api/1.0/doc/box/">Usage</a>
</h2>

<p>One way of usage is via the Gisfile CDN:</p>

<div class="highlight highlight-html">
<pre>
&lt;script src='http://gisfile.com/js/gisfile.kml.js'&gt;&lt;/script&gt;
</pre>
</div>

<p>If we are going to use kmz files you sloud add jszip.min.js script:</p>

<div class="highlight highlight-html">
<pre>
&lt;script src='http://gisfile.com/js/gisfile.kml.js'&gt;&lt;/script&gt;
&lt;script src='http://gisfile.com/js/jszip.min.js'&gt;&lt;/script&gt;
</pre>
</div>

<p>The <code>gisfile.kml.js</code> file does not includes the Leaflet and jsZip library. 
You will have to include the Leaflet and jsZip yourself.</p>
