#!/usr/bin/env python

import tempfile
import subprocess
import os
import json
from flask import Flask, request

app = Flask(__name__)

@app.route("/", methods=["POST"])
def index():
    # Load data as json
    raw_post_data = json.loads(request.data)
    content, editor = raw_post_data["content"], raw_post_data["editor"]

    # Create tmpfile, get editor command
    handle, file_name = tempfile.mkstemp(prefix="vimium-")
    command_args = "%s %s" % (editor, file_name)

    # Open file
    f = open(file_name, 'w')
    print >> f, content
    f.close()

    # Run the editor command and wait for it
    os.system(command_args)

    # Read file and then remove it
    f = open(file_name, 'r')
    contents = f.read()
    f.close()
    os.remove(file_name)

    return contents

if __name__ == "__main__":
    app.run(port=23456)
