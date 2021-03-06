<template src="./template.html"></template>
<style lang="scss" src="./style.scss"></style>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Lesson } from '@/models/managers/Lesson';
import { Classroom } from '@/models/managers/Classroom';
import { Discipline } from '@/models/managers/Discipline';
import { User } from '@/models/managers/User';
import {
  updateIfExists,
  DayNumber,
  getDayName,
  LessonNumber,
  getLessonNumberName
} from '@/models/Stuff';

import Page from '@/components/Page.vue';
import LessonModal from '@/components/LessonModal.vue';

@Component({
  components: {
    Page,
    LessonModal
  }
})
export default class TimeTablePage extends Vue {
  private lessonModal!: LessonModal;

  private lessons: Lesson[] = [];
  private classrooms: Classroom[] = [];
  private disciplines: Discipline[] = [];

  private users: User[] = [];

  private fullAccess: boolean = false;

  private async created() {
    this.$bus.on('lesson_updated', (lesson: Lesson) => {
      updateIfExists(this.lessons, lesson);
    });
    this.$bus.on(['lesson_created', 'lesson_removed'], async () => {
      this.lessons = await this.fetchLessons();
    });
  }

  private async mounted() {
    this.fullAccess =
      this.$state.userManager.authorized &&
      this.$state.userManager.currentUser!.fullAccess;

    this.lessonModal = this.$refs['lesson-modal'] as LessonModal;
    this.lessonModal.$on('submit', async (lesson: Lesson) => {
      this.lessonModal.setInProcess(true);

      const create: boolean = lesson.id < 0;

      try {
        if (create) {
          await this.$state.lessonManager.create(lesson);
        } else {
          await this.$state.lessonManager.update(lesson);
        }

        this.lessonModal.setVisible(false);
      } catch (e) {
        this.$notify({
          title: `Невозможно ${create ? 'создать' : 'изменить'} пару`,
          type: 'error'
        });
        this.lessonModal.setInProcess(false);
      }
    });

    this.users = this.fullAccess
      ? await this.$state.userManager.fetchAll()
      : [];

    [this.classrooms, this.disciplines, this.lessons] = await Promise.all([
      this.$state.classroomManager.fetchAll(),
      this.$state.disciplineManager.fetchAll(),
      this.fetchLessons()
    ]);
  }

  private addLesson(day: DayNumber, num: LessonNumber) {
    this.lessonModal.show(
      new Lesson({
        day,
        number: num
      })
    );
  }

  private openLog(lesson: Lesson) {
    this.$router.push({
      name: 'log',
      params: {
        id: lesson.id.toString()
      }
    });
  }

  private getDayName(day: DayNumber) {
    return getDayName(day);
  }

  private getTeacherName(lesson: Lesson) {
    const userIndex = this.users.findIndex(
      (user) => user.id === lesson.teacher
    );

    if (userIndex < 0) {
      return '';
    }

    return this.users[userIndex].fullName;
  }

  private getLessonNumberName(num: LessonNumber) {
    return getLessonNumberName(num);
  }

  private getLessonClassroomName(lesson: Lesson) {
    const index = this.classrooms.findIndex(
      (classroom) => classroom.id === lesson.classroom
    );

    return index < 0 ? '' : this.classrooms[index].name;
  }

  private getLessonDisciplineName(lesson: Lesson) {
    const index = this.disciplines.findIndex(
      (discipline) => discipline.id === lesson.discipline
    );

    return index < 0 ? '' : this.disciplines[index].name;
  }

  private async fetchLessons() {
    if (!this.$state.userManager.authorized) {
      return [];
    }

    return this.$state.lessonManager.fetchCurrentSemester(
      this.$state.userManager.currentUser!.fullAccess
        ? undefined
        : this.$state.userManager.currentUser!.id
    );
  }

  private get days() {
    const result: Lesson[][][] = Array(6)
      .fill(null)
      .map(() => {
        return Array(5)
          .fill(null)
          .map(() => []);
      });

    this.lessons.forEach((lesson) => {
      result[lesson.day][lesson.number].push(lesson);
    });

    return result;
  }
}
</script>
