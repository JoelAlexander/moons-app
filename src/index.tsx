import React from 'react';
import { createRoot } from 'react-dom/client';
import Page from './page';
import { BYORPC } from './byorpc';
import './index.css'; // if you have global styles

const container = document.getElementById('app');
const root = createRoot(container!!);
root.render(
  <BYORPC>
    <Page />
  </BYORPC>
);
