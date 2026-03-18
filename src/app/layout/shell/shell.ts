import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class ShellComponent {
  collapsed = signal(false);

  navItems: NavItem[] = [
    { label: 'dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'projects', route: '/projects', icon: 'folder' },
    { label: 'waterfall', route: '/charts/waterfall', icon: 'waterfall' },
  ];

  toggleSidebar(): void {
    this.collapsed.update((v) => !v);
  }
}