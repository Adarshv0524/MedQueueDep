import express from 'express';
import path from 'path';

export const serveStaticFiles = express.static(path.join(process.cwd(), 'public'));
