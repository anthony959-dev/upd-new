import { MultiSeries } from '@amonsour/ngx-charts';
import { Component, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { ColumnConfig } from '@dua-upd/upd-components';
import { I18nFacade } from '@dua-upd/upd/state';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';

@Component({
  selector: 'upd-project-details-calldrivers',
  templateUrl: './project-details-calldrivers.component.html',
  styleUrls: ['./project-details-calldrivers.component.css'],
})
export class ProjectDetailsCalldriversComponent implements OnInit {
  currentLang$ = this.i18n.currentLang$;

  calldriversChart$ = this.projectsDetailsService.calldriversChart$;
  calldriversTable$ = this.projectsDetailsService.calldriversTable$;
  calldriversCols: ColumnConfig<{ name: string; currValue: number; prevValue: number }>[] = [];

  dateRangeLabel$ = this.projectsDetailsService.dateRangeLabel$;
  comparisonDateRangeLabel$ = this.projectsDetailsService.comparisonDateRangeLabel$;

  constructor(private readonly projectsDetailsService: ProjectsDetailsFacade, private i18n: I18nFacade) {}


  ngOnInit() {
    combineLatest([
      this.currentLang$,
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
    ]).subscribe(([lang, dateRange, comparisonDateRange]) => {
      this.calldriversCols = [
        {
          field: 'name',
          header: this.i18n.service.translate('Inquiry line', lang),
        },
        {
          field: 'currValue',
          header: dateRange,
          pipe: 'number',
        },
        {
          field: 'prevValue',
          header: comparisonDateRange,
          pipe: 'number',
        },
      ];
    });
  }
}
