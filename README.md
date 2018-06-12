# DEMOS2

Prototype Django based e-voting application, to demonstrate DEMOS2's client-side encryption e-voting.

The previous repository for DEMOS2 by Carey Williams can be found at: https://github.com/CareyJWilliams/DEMOS2

### Dependencies

    Python: Version 2.7 (Anything higher than this will not currently work)
    Python packages: Specified in 'requirements.txt' - PyCharm will detect these dependencies and offer installation
    MySQL Server: Community Ed will do - initialised with legacy password authentication
    New MySQL DB User: Default username and password specified in 'aullauthdemo/settings.py'
    New MySQL DB: demos2 (also specified in 'aullauthdemo/settings.py') - make sure to set the charset to UTF8

Finally, with all the above dependencies in place, you can simply issue the following command to initialise the DB:

    python manage.py migrate

'aullauthdemo/settings.py' specifies the Google reCAPTCHA site key and private key which will need changing when deployed
onto a new domain.

### Running the server and creating a new user account

You can run the server with the following command:

    python manage.py runserver

The application will then be available at:

    127.0.0.1:8000

You can then click on 'Join' to create a new user account. Currently, a server error is thrown when you create a new
email account saying something like 'Too Many Attempts'. Rest assured that the account will have been created. Navigate
back to the home page and you should be able to log in. This will hopefully be fixed in a future version.

### Other

This was included in the previous readme and may be required:

The Node.js encryption server depends on the milagro-crypto-js library. Download the source and follow the instructions for installation: https://github.com/milagro-crypto/milagro-crypto-js. To install, place the package's files (`package.json` level) into the directory Node/milagro-crypto-js (a new folder) then run `npm install` in the Node folder. This should install dependencies including the local package you just added.
