FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip

RUN npm install -g node-fetch@2

RUN pip3 install --no-cache-dir \
    flask==3.0.0 \
    flask-cors==4.0.0 \
    subprocess.run==0.0.8

WORKDIR /app

COPY run.py /app/run.py

EXPOSE 5000

CMD ["python3", "run.py"]
