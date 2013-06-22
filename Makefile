TARGET=s3://jaz303/colorscope.js

deploy:
	s3cmd put colorscope.js $(TARGET)
	s3cmd setacl --acl-public $(TARGET)