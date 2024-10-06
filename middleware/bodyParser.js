import bodyParser from 'body-parser';

export const urlencodedParser = bodyParser.urlencoded({ extended: true });
export const jsonParser = bodyParser.json();
