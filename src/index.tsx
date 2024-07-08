import React from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import Page from './page';
import './index.css'; // if you have global styles

const container = document.getElementById('app');
const root = createRoot(container!!);
root.render(<Page />);
