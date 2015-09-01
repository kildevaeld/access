'use strict';

const gulp = require('gulp'),
	tsc = require('gulp-typescript'),
	babel = require('gulp-babel');
	
const tsp = tsc.createProject('./tsconfig.json', {
	declarationFiles: true,
	target: 'es6',
	modules:'commonjs',
	typescript: require('typescript')
});

gulp.task('build', function () {
	
	return tsp.src('./src/**/*.ts')
	.pipe(tsc(tsp))
	.pipe(babel({
		blacklist: ['regenerator', 'es6.classes']
	}))
	.pipe(gulp.dest('./lib'));
	
});

gulp.task('watch', ['build'], function () {
	return gulp.watch('./src/**/*.ts', ['build']);
})

gulp.task('default', ['build'])
