/*global module:false*/

/*
 * Usage:
 *
 * `grunt`: alias for `grunt devel`.
 *
 * `grunt devel`: Generate and lint doctortc-devel.js.
 *
 * `grunt watch`: Watch changes in src/js/ files and run `grunt js` to
 *                generate dist/doctortc-devel.js.
 *                It's 100% useful to let this task running while in
 *                development status.
 *
 * `grunt dist`: Generate and lint doctortc-X.Y.Z.js and
 *               doctortc-X.Y.Z.min.js.
 */


module.exports = function(grunt) {

	// NOTE: src/EventEmitter.js is included with grunt-include-replace (via @@include).
	var jsFiles = [
		'src/DoctoRTC.js',
		'src/Adaptor.js',
		'src/Utils.js',
		'src/NetworkTester.js'
	];

	// Project configuration.
	grunt.initConfig({

		pkg: grunt.file.readJSON('package.json'),

		meta: {
			banner: '(function(window) {\n\n',
			footer: '\n\n\nwindow.DoctoRTC = DoctoRTC;\n}(window));\n\n'
		},

		concat: {
			devel: {
				src: jsFiles,
				dest: 'dist/<%= pkg.name %>-devel.js',
				options: {
					banner: '<%= meta.banner %>',
					separator: '\n\n',
					footer: '<%= meta.footer %>',
					process: true
				},
				nonull: true
			},
			dist: {
				src: jsFiles,
				dest: 'dist/<%= pkg.name %>-<%= pkg.version %>.js',
				options: {
					banner: '<%= meta.banner %>',
					separator: '\n\n',
					footer: '<%= meta.footer %>',
					process: true
				},
				nonull: true
			}
		},

		includereplace: {
			dist: {
				src: 'dist/<%= pkg.name %>-<%= pkg.version %>.js',
				dest: './'
			},
			devel: {
				src: 'dist/<%= pkg.name %>-devel.js',
				dest: './'
			}
		},

		jshint: {
			devel: 'dist/<%= pkg.name %>-devel.js',
			dist: 'dist/<%= pkg.name %>-<%= pkg.version %>.js',
			options: {
				browser: true,
				curly: true,
				devel: true,  // Otherwise 'console.log' is considered an error.
				eqeqeq: true,
				immed: true,
				latedef: true,
				newcap: false,
				noarg: true,
				sub: true,
				undef: true,
				boss: true,
				eqnull: true,
				onecase: true,
				unused: true,
				supernew: true,
				globals: { }
			}
		},

		uglify: {
			dist: {
				files: {
					'dist/<%= pkg.name %>-<%= pkg.version %>.min.js': ['dist/<%= pkg.name %>-<%= pkg.version %>.js']
				}
			}
		},

		watch: {
			js: {
				files: ['src/*.js'],
				tasks: ['devel'],
				options: {
					nospawn: true
				}
			}
		}
	});


	// Load Grunt plugins.
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-include-replace');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-watch');


	// Task for building everything and generate doctortc-devel.js (uncompressed).
	grunt.registerTask('devel', ['concat:devel', 'includereplace:devel', 'jshint:devel']);

	// Task for building doctortc-X.Y.Z.js (uncompressed) and doctortc-X.Y.Z.min.js (minified).
	grunt.registerTask('dist', ['concat:dist', 'includereplace:dist', 'jshint:dist', 'uglify:dist']);

	// Default task is an alias for 'devel'.
	grunt.registerTask('default', ['devel']);

};
