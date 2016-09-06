var
	gulp = require('gulp'),
	jscs = require('gulp-jscs'),
	stylish = require('gulp-jscs-stylish'),
	browserify = require('browserify'),
	vinyl_transform = require('vinyl-transform'),
	rename = require('gulp-rename'),
	jshint = require('gulp-jshint'),
	filelog = require('gulp-filelog'),
	pkg = require('./package.json');

gulp.task('lint', function () {
	var src = ['gulpfile.js', 'lib/**/*.js'];

	return gulp.src(src)
		.pipe(filelog('lint'))
		.pipe(jshint('.jshintrc')) // enforce good practics
		.pipe(jscs('.jscsrc')) // enforce style guide
		.pipe(stylish.combineWithHintResults())
		.pipe(jshint.reporter('jshint-stylish', {verbose: true}))
		.pipe(jshint.reporter('fail'));
});

gulp.task('browserify', function () {
	var
		browserified,
		src = pkg.main;

	browserified = vinyl_transform(function (filename) {
		var b = browserify(filename, {
			standalone: pkg.name
		});

		return b.bundle();
	});

	return gulp.src(src)
		.pipe(filelog('browserify'))
		.pipe(browserified)
		.pipe(rename(pkg.name + '.js'))
		.pipe(gulp.dest('dist/'));
});

gulp.task('default', gulp.series('lint', 'browserify'));
