require 'bundler/gem_tasks'
require 'bundler/cli'
require 'fileutils'
require 'optparse'

namespace :binnacle do
  desc "Pull JS assets from rails-assets-binnacle gem into vendo/assets/javascripts"
  task :install_binnacle_js do

    gems = [
      'base64',
      'moment',
      'atmosphere',
      'firebase',
      'binnacle'
    ]

    rails_manifest = "#{Dir.pwd}/vendor/assets/javascripts/binnacle.js"

    FileUtils.rm_rf(Dir.glob("{Dir.pwd}/vendor/assets/javascripts/*"))

    File.open(rails_manifest, "w+") do |f|
      gems.each do |gem_name|
        puts "Processing asset gem #{gem_name}..."
        rails_assets_name = "rails-assets-#{gem_name}"
        gem_directory = Bundler.rubygems.find_name(rails_assets_name).first.full_gem_path
        gem_manifest = "#{gem_directory}/app/assets/javascripts/#{gem_name}.js"
        source_assets_directory = "#{gem_directory}/app/assets/javascripts/#{gem_name}"
        target_assets_directory = "#{Dir.pwd}/vendor/assets/javascripts/#{gem_name}"

        target = File.dirname(target_assets_directory)
        unless File.directory?(target)
          FileUtils.mkdir_p(target)
          puts "> creating target assets directory #{target_assets_directory}"
        end

        puts "> copying JS assets from #{rails_assets_name} to /app/assets/javascripts/#{gem_name}"
        FileUtils.cp_r "#{source_assets_directory}/.", target_assets_directory, :verbose => true

        puts "> writing #{gem_name} manifest contents to binnacle manifest..."
        File.open(gem_manifest, "rb") do |fm|
          contents = fm.read
          f.puts(contents)
        end
      end
    end
  end
end
