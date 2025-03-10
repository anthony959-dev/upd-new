import { Component, inject, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { EN_CA, type LocaleId } from '@dua-upd/upd/i18n';
import {
  type ColumnConfig,
  feedbackKpiObjectiveCriteria,
} from '@dua-upd/upd-components';
import { I18nFacade } from '@dua-upd/upd/state';
import type { GetTableProps } from '@dua-upd/utils-common';
import { PagesDetailsFacade } from '../+state/pages-details.facade';

type TasksTableColTypes = GetTableProps<PagesDetailsSummaryComponent, 'tasks$'>;
type BarTableColTypes = GetTableProps<
  PagesDetailsSummaryComponent,
  'barTable$'
>;
type VisitsByDeviceColTypes = GetTableProps<
  PagesDetailsSummaryComponent,
  'visitsByDeviceTypeTable$'
>;

@Component({
  selector: 'upd-page-details-summary',
  templateUrl: './pages-details-summary.component.html',
  styleUrls: ['./pages-details-summary.component.css'],
})
export class PagesDetailsSummaryComponent implements OnInit {
  private i18n = inject(I18nFacade);
  private pageDetailsService = inject(PagesDetailsFacade);

  currentLang!: LocaleId;
  currentLang$ = this.i18n.currentLang$;

  data$ = this.pageDetailsService.pagesDetailsData$;
  error$ = this.pageDetailsService.error$;

  apexKpiFeedback$ = this.pageDetailsService.apexKpiFeedback$;

  currentKpiFeedback$ = this.pageDetailsService.currentKpiFeedback$;
  kpiFeedbackPercentChange$ = this.pageDetailsService.kpiFeedbackPercentChange$;
  feedbackKpiObjectiveCriteria = feedbackKpiObjectiveCriteria;
  kpiFeedbackDifference$ = this.pageDetailsService.kpiFeedbackDifference$;

  url$ = this.pageDetailsService.pageUrl$;

  visitors$ = this.pageDetailsService.visitors$;
  visitorsPercentChange$ = this.pageDetailsService.visitorsPercentChange$;

  visits$ = this.pageDetailsService.visits$;
  visitsPercentChange$ = this.pageDetailsService.visitsPercentChange$;

  pageViews$ = this.pageDetailsService.pageViews$;
  pageViewsPercentChange$ = this.pageDetailsService.pageViewsPercentChange$;

  visitsByDay$ = this.pageDetailsService.visitsByDay$;

  visitsByDeviceType$ = this.pageDetailsService.visitsByDeviceType$;

  topSearchTermsIncrease$ = this.pageDetailsService.topSearchTermsIncrease$;

  topSearchTermsDecrease$ = this.pageDetailsService.topSearchTermsDecrease$;

  tasks$ = this.pageDetailsService.tasks$;
  tasksCols: ColumnConfig<TasksTableColTypes>[] = [];

  dateRangeLabel$ = this.pageDetailsService.dateRangeLabel$;
  comparisonDateRangeLabel$ = this.pageDetailsService.comparisonDateRangeLabel$;

  apexBar$ = this.pageDetailsService.apexBar$;
  barTable$ = this.pageDetailsService.barTable$;
  barTableCols: ColumnConfig<BarTableColTypes>[] = [];

  apexVisitsByDeviceTypeChart$ =
    this.pageDetailsService.apexVisitsByDeviceTypeChart$;
  apexVisitsByDeviceTypeLabels$ =
    this.pageDetailsService.apexVisitsByDeviceTypeLabels$;

  visitsByDeviceTypeTable$ = this.pageDetailsService.visitsByDeviceTypeTable$;
  visitsByDeviceTypeCols: ColumnConfig<VisitsByDeviceColTypes>[] = [];
  langLink = 'en';

  topSearchTermsCols: ColumnConfig[] = [];

  ngOnInit() {
    this.i18n.service.onLangChange(({ lang }) => {
      this.currentLang = lang as LocaleId;
    });

    combineLatest([
      this.currentLang$,
      this.dateRangeLabel$,
      this.comparisonDateRangeLabel$,
    ]).subscribe(([lang, dateRange, comparisonDateRange]) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';
      this.topSearchTermsCols = [
        {
          field: 'term',
          header: this.i18n.service.translate('search-term', lang),
        },
        {
          field: 'impressions',
          header: this.i18n.service.translate('impressions', lang),
          pipe: 'number',
          pipeParam: '1.0-2',
        },
        {
          field: 'change',
          header: this.i18n.service.translate('comparison', lang),
          pipe: 'percent',
        },
        {
          field: 'ctr',
          header: this.i18n.service.translate('ctr', lang),
          pipe: 'percent',
        },
        {
          field: 'position',
          header: this.i18n.service.translate('position', lang),
          pipe: 'number',
          pipeParam: '1.0-2',
        },
      ];
      this.barTableCols = [
        { field: 'date', header: this.i18n.service.translate('Dates', lang) },
        {
          field: 'visits',
          header: this.i18n.service.translate('Visits for ', lang, {
            value: dateRange,
          }),
          pipe: 'number',
        },
        {
          field: 'prevDate',
          header: this.i18n.service.translate('Dates', lang),
        },
        {
          field: 'prevVisits',
          header: this.i18n.service.translate('Visits for ', lang, {
            value: comparisonDateRange,
          }),
          pipe: 'number',
        },
      ];
      this.visitsByDeviceTypeCols = [
        {
          field: 'name',
          header: this.i18n.service.translate('Device Type', lang),
        },
        { field: 'currValue', header: dateRange, pipe: 'number' },
        { field: 'prevValue', header: comparisonDateRange, pipe: 'number' },
      ];
      this.tasksCols = [
        {
          field: 'title',
          header: this.i18n.service.translate('Task', lang),
          type: 'link',
          typeParams: {
            preLink: '/' + this.langLink + '/tasks',
            link: '_id',
          },
        },
      ];
    });
  }
}
