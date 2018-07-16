# DEMOS2

Prototype Django-based e-voting application, to demonstrate DEMOS2's client-side
encryption e-voting.

The previous repository for DEMOS2 by Carey Williams can be found at:
https://github.com/CareyJWilliams/DEMOS2

## Setup

### Main Application Dependencies

* Python: Version 2.7 (anything higher than this will not currently work)
* Python packages: Specified in `requirements.txt` - PyCharm will detect these dependencies and offer installation
* MySQL Server: Community Edition (initialise with 'legacy password authentication')
* New MySQL DB User: Default username and password specified in `aullauthdemo/settings.py`
* New MySQL DB: `demos2` (also specified in `aullauthdemo/settings.py`) - make sure to set the charset to 'UTF8'

### Database setup

After installing the above dependencies, issue the following command to initialise the DB:

```
python manage.py migrate
```

The first run will produce a `django.db.utils.IntegrityError: (1215, 'Cannot add foreign key constraint')` error. Issue the command a second time and it will complete successfully.

### Settings

`allauthdemo/settings.py` specifies the Google reCAPTCHA site key and private key, which will need changing when deployed onto a new domain.
There is also a `DOMAIN` setting within the file that needs updating during deployment as things like email functionality depend on this setting for correct URL generation during event preparation etc. 

Emails from the application are currently sent from the following email account which can be updated within the settings:

```
demos2.no.reply@gmail.com
```

### NodeJS Dependencies

The Node.js crypto server depends on the `milagro-crypto-js` and `express` modules. A `package.json` file can be found in the `Node/` directory with these dependency requirements and therefore from this folder you can run:

```
npm install
```

Once the dependencies have been installed, you can then run the node server as per the below instructions.

## InstructionsRunning

### Step 1: Running the Python app and creating a new user account

You can run the server with the following command:

```
python manage.py runserver
```

The application will then be available at `127.0.0.1:8000`.

You can then click on 'Join' to create a new user account. Currently, a server error is thrown when you create a new email account saying something like 'Too Many Attempts'. Rest assured that the account will have been created. Navigate back to the home page and you should be able to log in. This will hopefully be fixed in a future version.

### Step 2: Running Celery

Celery is used to run tasks asynchronously and the DEMOS2 application can't run without this application. A bash script called `start_celery_worker.sh` is provided to make starting a worker as easy as possible:

```
./start_celery_worker.sh
```

### Step 3: Running the Node.js Server

The Node.js server exposes a lot of cryptographic operations that the application depends on throughout. To run the server, issue the following command line request from the `Node/` folder:

```
node index.js
```
