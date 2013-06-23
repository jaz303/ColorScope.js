test.htm: bookmarklet.js tpl/header.htm tpl/footer.htm
	cat tpl/header.htm bookmarklet.js tpl/footer.htm > test.htm
	
bookmarklet.js: colorscope.js
	./node_modules/uglify-js/bin/uglifyjs colorscope.js | sed 's/"/\&quot;/g' > bookmarklet.js

clean:
	rm -f test.htm bookmarklet.js