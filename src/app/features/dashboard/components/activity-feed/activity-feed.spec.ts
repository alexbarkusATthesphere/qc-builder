import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivityFeed } from './activity-feed';

describe('ActivityFeed', () => {
  let component: ActivityFeed;
  let fixture: ComponentFixture<ActivityFeed>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivityFeed]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActivityFeed);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
