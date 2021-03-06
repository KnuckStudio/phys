<template src="./template.html"></template>
<style lang="scss" src="./style.scss"></style>

<script lang="ts">
import { Component, Vue, Mixins } from 'vue-property-decorator';
import moment from 'moment-timezone';
import _ from 'underscore';

import Page from '@/components/Page.vue';
import GeneralModal from '@/components/GeneralModal.vue';
import LessonStudentModal from '@/components/LessonStudentModal.vue';
import LessonModal from '@/components/LessonModal.vue';
import HasDatepickerMixin from '@/components/HasDatepickerMixin.vue';

import { Student } from '@/models/managers/Student';
import { Test } from '@/models/managers/Test';
import { Lesson, LessonFullInfo } from '@/models/managers/Lesson';
import { Classroom } from '@/models/managers/Classroom';
import { Discipline } from '@/models/managers/Discipline';
import { Semester } from '@/models/managers/Semester';
import { Group } from '@/models/managers/Group';
import { Module } from '@/models/managers/Module';
import { Mark } from '@/models/managers/Mark';
import { StudentVisit } from '@/models/managers/StudentVisit';
import { StudentInfo } from '@/models/managers/StudentInfo';
import { StudentTestMark } from '@/models/managers/StudentTestMark';

import {
  getLessonNumberName,
  getDayName,
  insertOrUpdate,
  deleteByIndex,
  findById,
  findIndexById
} from '@/models/Stuff';

type State = 'schedule' | 'tests' | 'infos';

interface ModuleWeek {
  number: number;
  date: Date;
}

type StudentVisitOptional = StudentVisit | null;

@Component({
  components: {
    Page,
    GeneralModal,
    LessonModal,
    LessonStudentModal
  }
})
export default class LogPage extends Mixins(HasDatepickerMixin) {
  private lessonStudentModal!: LessonStudentModal;
  private lessonModal!: LessonModal;
  private receiptDateModal!: GeneralModal;
  private examDateModal!: GeneralModal;

  private filterString: string = '';

  private uniqueVisitsKey: number = 0;
  private uniqueTestMarksKey: number = 0;
  private state: State = 'schedule';

  private lesson: Lesson = new Lesson();
  private classroom: Classroom = new Classroom();
  private discipline: Discipline = new Discipline();
  private semester: Semester = new Semester();
  private modules: Module[] = [];
  private students: Student[] = [];
  private groups: Group[] = [];

  private marks: Mark[] = [];
  private tests: Test[] = [];

  private studentVisits: StudentVisit[] = [];
  private studentTestMarks: StudentTestMark[] = [];
  private studentInfos: StudentInfo[] = [];

  private moduleWeeks: ModuleWeek[][] = [];
  private weekToModule: Map<number, number> = new Map();
  private moduleVisits: StudentVisitOptional[][][] = [];

  private fullAccess: boolean = false;

  private apiThrottler = _.debounce((cb: () => any) => cb(), 500, false);

  private created() {
    this.$bus.on(
      'lesson_updated',
      (lesson: Lesson) => {
        this.lesson = lesson;
      },
      this
    );

    this.$bus.on(
      'lesson_student_added',
      async (entry: { lessonId: number; studentId: number }) => {
        if (!this.isLessonInitialized || this.lesson.id !== entry.lessonId) {
          return;
        }

        const student = await this.$state.studentManager.fetchOne(
          entry.studentId
        );

        const groupIndex = findIndexById(this.groups, student.group);
        if (groupIndex < 0) {
          insertOrUpdate(
            this.groups,
            await this.$state.groupManager.fetchOne(student.group)
          );
        }

        insertOrUpdate(this.students, student);

        this.fillStudentVisits();
      },
      this
    );

    this.$bus.on(
      'lesson_student_removed',
      (entry: { lessonId: number; studentId: number }) => {
        if (!this.isLessonInitialized || this.lesson.id !== entry.lessonId) {
          return;
        }

        deleteByIndex(this.students, entry.studentId);

        this.fillStudentVisits();
      },
      this
    );

    this.$bus.on(
      'student_test_mark_updated',
      (mark: StudentTestMark) => {
        insertOrUpdate(this.studentTestMarks, mark);
      },
      this
    );

    this.$bus.on(
      ['student_test_mark_created', 'student_test_mark_removed'],
      async (data) => {
        this.studentTestMarks = await this.$state.lessonManager.fetchTestMarks(
          this.lesson.id
        );
      },
      this
    );

    this.$bus.on('student_visit_updated', (visit: StudentVisit) => {
      insertOrUpdate(this.studentVisits, visit);
    });

    this.$bus.on(
      ['student_visit_created', 'student_visit_removed'],
      async () => {
        this.studentVisits = await this.$state.lessonManager.fetchVisits(
          this.lesson.id
        );
      },
      this
    );

    this.$bus.on(
      ['student_info_updated', 'student_info_created'],
      (info: StudentInfo) => {
        insertOrUpdate(this.studentInfos, info);
      },
      this
    );

    this.$bus.on('student_info_removed', async (id) => {
      deleteByIndex(this.studentInfos, id);
    });
  }

  private beforeDestroy() {
    this.$bus.clear(this);
  }

  private async beforeMount() {
    this.reset();

    const lessonId = parseInt(this.$route.params.id, 10) || 0;

    try {
      const [info, marks] = await Promise.all([
        this.$state.lessonManager.fetchFullInfo(lessonId),
        this.$state.markManager.fetchAll()
      ]);

      this.classroom = info.classroom;
      this.discipline = info.discipline;
      this.semester = info.semester;
      this.modules = info.modules;
      this.students = info.students;
      this.groups = info.groups;
      this.tests = info.tests;

      this.lesson = info.lesson;

      this.marks = marks;

      this.studentVisits = await this.$state.lessonManager.fetchVisits(
        this.lesson.id
      );

      this.fillWeeks();
      this.fillStudentVisits();

      this.studentTestMarks = await this.$state.lessonManager.fetchTestMarks(
        this.lesson.id
      );

      this.studentInfos = await this.$state.lessonManager.fetchInfos(
        this.lesson.id
      );
    } catch (e) {
      this.$router.back();
      this.$notify({
        title: 'Не удалось открыть журнал',
        type: 'error'
      });
      return;
    }
  }

  private mounted() {
    this.fullAccess =
      this.$state.userManager.authorized &&
      this.$state.userManager.currentUser!.fullAccess;

    this.lessonStudentModal = this.$refs[
      'lesson-student-modal'
    ] as LessonStudentModal;
    this.lessonModal = this.$refs['lesson-modal'] as LessonModal;
    this.receiptDateModal = this.$refs['receipt-date-modal'] as GeneralModal;
    this.examDateModal = this.$refs['exam-date-modal'] as GeneralModal;
  }

  private editLesson() {
    this.lessonModal.show(this.lesson);
  }

  private addStudent() {
    this.lessonStudentModal.show({
      student: -1
    });
  }

  private async removeStudent(student: Student) {
    if (!confirm('Вы действительно хотите удалить студента?')) {
      return;
    }

    try {
      await this.$state.lessonManager.removeStudent(this.lesson.id, student.id);
    } catch (e) {
      this.$notify({
        title: 'Невозможно удалить студента',
        type: 'error'
      });
    }
  }

  private async onSubmitLessonModal(lesson: Lesson) {
    this.lessonModal.setInProcess(true);

    try {
      await this.$state.lessonManager.update(lesson);
      this.lessonModal.setVisible(false);
    } catch (e) {
      this.$notify({
        title: 'Невозможно изменить пару',
        type: 'error'
      });
      this.lessonModal.setInProcess(false);
    }
  }

  private async onSubmitLessonStudentModal({ student }: { student: number }) {
    this.lessonStudentModal.setInProcess(true);

    try {
      await this.$state.lessonManager.addStudent(this.lesson.id, student);
      this.lessonStudentModal.setVisible(false);
    } catch (e) {
      this.$notify({
        title: 'Невозможно добавить студента',
        type: 'error'
      });
      this.lessonStudentModal.setInProcess(false);
    }
  }

  private get filteredStudents() {
    return this.students.filter((s) => {
      if (this.filterString.length === 0) {
        return true;
      }

      const group = this.getStudentGroup(s);

      const words = this.filterString.toLowerCase().split(' ');
      return words.every(
        (w) =>
          s.fullName.toLowerCase().includes(w) ||
          (group != null && group.name.toLowerCase().includes(w))
      );

      return false;
    });
  }

  private getTabClass(tab: string) {
    return {
      active: this.state === tab
    };
  }

  private getStudentGroup(student: Student) {
    return findById(this.groups, student.group);
  }

  private reset() {
    this.lesson = new Lesson();
    this.classroom = new Classroom();
    this.discipline = new Discipline();
    this.semester = new Semester();
    this.students = [];
    this.groups = [];
    this.tests = [];

    this.marks = [];
    this.studentVisits = [];
    this.studentTestMarks = [];
    this.studentInfos = [];

    this.moduleWeeks = [];
    this.moduleVisits = [];
  }

  private fillWeeks() {
    const weeks = this.lessonDates;

    this.moduleWeeks = this.modules.map(() => []);
    this.weekToModule = new Map();

    let w = 0;
    for (let m = 0; m < this.modules.length; ++m) {
      // Offset weeks which are not in range
      while (
        w < weeks.length &&
        (weeks[w] < this.modules[m].begin || weeks[w] > this.modules[m].end)
      ) {
        ++w;
      }

      // Add weeks which are in range
      for (
        ;
        w < weeks.length &&
        weeks[w] >= this.modules[m].begin &&
        weeks[w] <= this.modules[m].end;
        ++w
      ) {
        this.moduleWeeks[m].push({
          number: w,
          date: weeks[w]
        });
        this.weekToModule.set(w, m);
      }
    }
  }

  private fillStudentVisits() {
    const lessonDates = this.lessonDates;

    // Fill student visits
    this.moduleVisits = this.students.map((student) => {
      const moduleVisits: StudentVisitOptional[][] = this.moduleWeeks.map(
        (weeks) => weeks.map(() => null)
      );

      this.studentVisits
        .filter((v) => v.student === student.id)
        .forEach((v) => {
          if (v.week < lessonDates.length) {
            // Find module
            const moduleIndex = this.weekToModule.get(v.week);
            if (moduleIndex == null) {
              return;
            }

            // Find Index
            const weekIndex = this.moduleWeeks[moduleIndex].findIndex(
              (w) => w.number === v.week
            );
            if (weekIndex == null) {
              return;
            }

            // Set visit to week in module
            moduleVisits[moduleIndex][weekIndex] = v;
          }
        });

      return moduleVisits;
    });
  }

  private getStudentVisits(student: Student) {
    const studentIndex = this.students.findIndex((s) => s.id === student.id);
    if (studentIndex < 0 || studentIndex >= this.moduleVisits.length) {
      return [];
    }

    return this.moduleVisits[studentIndex];
  }

  private getStudentTestMark(student: Student, test: Test) {
    const markIndex = this.studentTestMarks.findIndex(
      (info) => info.student === student.id && info.test === test.id
    );

    if (markIndex < 0) {
      return null;
    }

    return this.studentTestMarks[markIndex].result;
  }

  private getStudentInfo(student: Student) {
    const infoIndex = this.studentInfos.findIndex(
      (info) => info.student === student.id
    );

    if (infoIndex < 0) {
      const info = new StudentInfo({
        student: student.id,
        semester: this.semester.id
      });
      this.studentInfos.push(info);
      return info;
    }

    return this.studentInfos[infoIndex];
  }

  private async onMarkChanged(
    student: Student,
    moduleIndex: number,
    visitIndex: number,
    value: number
  ) {
    const studentVisits = this.getStudentVisits(student);
    const visit = studentVisits[moduleIndex][visitIndex];

    if (value == null) {
      if (visit == null) {
        return;
      }

      try {
        await this.$state.studentVisitManager.remove(visit.id);
        this.updateVisit(student, moduleIndex, visitIndex, null);
      } catch (e) {
        this.$notify({
          title: 'Невозможно удалить посещение',
          type: 'error'
        });
        this.updateVisit(student, moduleIndex, visitIndex, visit);
      }
      return;
    }

    const create = visit == null;

    try {
      let res: StudentVisit = new StudentVisit();
      if (create) {
        res = await this.$state.studentVisitManager.create({
          mark: value,
          week: this.moduleWeeks[moduleIndex][visitIndex].number,
          lesson: this.lesson.id,
          student: student.id
        });
      } else {
        res = await this.$state.studentVisitManager.update({
          ...visit!,
          mark: value
        });
      }

      this.updateVisit(student, moduleIndex, visitIndex, res);
    } catch (e) {
      this.$notify({
        title: `Невозможно ${create ? 'создать' : 'изменить'} посещение`,
        type: 'error'
      });
      this.updateVisit(student, moduleIndex, visitIndex, visit);
    }
  }

  private async onTestMarkChanged(student: Student, test: Test, value: string) {
    this.apiThrottler(async () => {
      const markIndex = this.studentTestMarks.findIndex(
        (info) => info.student === student.id && info.test === test.id
      );

      if (value.length === 0) {
        if (markIndex >= 0) {
          const testMark = this.studentTestMarks[markIndex];
          try {
            await this.$state.studentTestMarkManager.remove(testMark.id);
            return;
          } catch (e) {
            this.$notify({
              title: 'Невозможно удалить результат',
              type: 'error'
            });
            ++this.uniqueTestMarksKey;
            return;
          }
        } else {
          return;
        }
      }

      const result = parseFloat(value);

      const create = markIndex < 0;

      try {
        if (create) {
          await this.$state.studentTestMarkManager.create(
            new StudentTestMark({
              test: test.id,
              result,
              student: student.id,
              semester: this.semester.id
            })
          );
        } else {
          await this.$state.studentTestMarkManager.update({
            ...this.studentTestMarks[markIndex],
            result
          });
        }
      } catch (e) {
        this.$notify({
          title: `Невозможно ${create ? 'создать' : 'изменить'} результат`,
          type: 'error'
        });
        ++this.uniqueTestMarksKey;
      }
    });
  }

  private updateVisit(
    student: Student,
    moduleIndex: number,
    visitIndex: number,
    value: StudentVisit | null
  ) {
    const studentIndex = this.students.findIndex((s) => s.id === student.id);

    const moduleVisits = this.moduleVisits[studentIndex];
    moduleVisits[moduleIndex][visitIndex] = value;

    Vue.set(this.moduleVisits, studentIndex, moduleVisits);

    ++this.uniqueVisitsKey;
  }

  private getModuleSumm(visits: Array<StudentVisit | null>) {
    return visits.reduce((sum, visit) => {
      if (visit == null) {
        return sum;
      }

      const mark = findById(this.marks, visit.mark);
      return sum + ((mark && mark.weight) || 0);
    }, 0);
  }

  private getStudentSumm(student: Student) {
    const studentVisits = this.getStudentVisits(student);
    return studentVisits.reduce((sum, m) => sum + this.getModuleSumm(m), 0);
  }

  private getTotalStudentSumm(student: Student) {
    const studentInfo = this.getStudentInfo(student);
    return (
      this.getStudentSumm(student) +
      studentInfo.summ +
      this.tests.reduce(
        (summ, test) => summ + this.getTestResult(student, test),
        0
      )
    );
  }

  private getTestResult(student: Student, test: Test) {
    const markIndex = this.studentTestMarks.findIndex(
      (mark) => mark.student === student.id && mark.test === test.id
    );

    if (markIndex < 0) {
      return 0;
    }

    return test.convert(
      this.studentTestMarks[markIndex].result,
      student.gender
    );
  }

  private editReceiptDate(info: StudentInfo) {
    this.receiptDateModal.show(info);
  }

  private editExamDate(info: StudentInfo) {
    this.examDateModal.show(info);
  }

  private formatDate(date: Date) {
    return moment(date).format('DD.MM.YYYY');
  }

  private isModuleActive(moduleIndex: number) {
    if (moduleIndex >= this.modules.length) {
      return false;
    }

    return this.modules[moduleIndex].isActive;
  }

  private async updateInfo(
    info: StudentInfo,
    fromModal: boolean = true,
    property?: keyof Pick<
      StudentInfo,
      Exclude<keyof StudentInfo, 'id' | 'summ'>
    >
  ) {
    this.apiThrottler(async () => {
      if (fromModal) {
        this.receiptDateModal.setInProcess(true);
        this.examDateModal.setInProcess(true);
      }

      const infoIndex = this.studentInfos.findIndex(
        (i) => i.student === info.student
      );

      const create = info.id < 0;

      try {
        let res: StudentInfo;
        if (create) {
          res = await this.$state.studentInfoManager.create(info);
        } else {
          res = await this.$state.studentInfoManager.update(info, property);
        }

        Vue.set(this.studentInfos, infoIndex, res);

        if (fromModal) {
          this.receiptDateModal.setVisible(false);
          this.examDateModal.setVisible(false);
        }
      } catch (e) {
        this.$notify({
          title: 'Невозможно изменить информацию о студенте',
          type: 'error'
        });

        if (fromModal) {
          this.receiptDateModal.setInProcess(false);
          this.examDateModal.setInProcess(false);
        }
      }
    });
  }

  private get lessonDates() {
    const weekBegin = moment(this.semester.begin).startOf('week');
    const end = moment(this.semester.end);

    const weeks: Date[] = [];

    const current = weekBegin.add(this.lesson.day, 'days');
    while (current < end) {
      weeks.push(current.toDate());
      current.add(1, 'week');
    }

    return weeks;
  }

  private get lessonTitle() {
    if (!this.isLessonInitialized) {
      return '';
    }

    return `${getDayName(this.lesson.day)}, ${getLessonNumberName(
      this.lesson.number
    )}, ${this.classroom.name}, ${this.discipline.name}`;
  }

  private get isLessonInitialized() {
    return this.lesson.id > 0;
  }

  private get markOptions() {
    const options: Array<{ value: number | null; text: string }> = [
      { value: null, text: '' }
    ];

    return options.concat(
      this.marks.map((m) => ({
        value: m.id,
        text: m.symbol
      }))
    );
  }
}
</script>
