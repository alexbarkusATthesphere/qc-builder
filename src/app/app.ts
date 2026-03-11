import { Component } from '@angular/core';
import { ShellComponent } from './layout/shell/shell';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}